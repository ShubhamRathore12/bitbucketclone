package middleware

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

// RateLimitConfig controls the behaviour of the sliding-window rate limiter.
type RateLimitConfig struct {
	// Max is the maximum number of requests allowed in the Window.
	Max int
	// Window is the sliding window duration.
	Window time.Duration
	// KeyGenerator derives a unique key per client. Defaults to IP address.
	KeyGenerator func(c *fiber.Ctx) string
}

// DefaultRateLimitConfig returns a sensible default: 100 requests per minute
// keyed by client IP.
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		Max:    100,
		Window: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
	}
}

// slidingWindowScript is a Lua script executed atomically in Redis.
// It implements a sliding-window counter using a sorted set.
//
// KEYS[1] = the rate-limit key
// ARGV[1] = current timestamp in microseconds (score & member prefix)
// ARGV[2] = window size in microseconds
// ARGV[3] = maximum allowed requests
//
// Returns: {allowed (0|1), remaining, reset_at_unix_ms}
var slidingWindowScript = redis.NewScript(`
local key      = KEYS[1]
local now      = tonumber(ARGV[1])
local window   = tonumber(ARGV[2])
local max      = tonumber(ARGV[3])

local window_start = now - window

-- Remove entries outside the current window.
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- Count current entries.
local count = redis.call('ZCARD', key)

if count < max then
    -- Add the current request.
    redis.call('ZADD', key, now, tostring(now) .. ':' .. tostring(math.random(1000000)))
    redis.call('PEXPIRE', key, math.ceil(window / 1000))
    return {1, max - count - 1, math.ceil((now + window) / 1000)}
else
    -- Compute when the oldest entry in the window expires.
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local reset  = 0
    if #oldest > 0 then
        reset = math.ceil((tonumber(oldest[2]) + window) / 1000)
    end
    return {0, 0, reset}
end
`)

// NewRateLimiter creates a Redis-backed sliding-window rate limiter middleware.
func NewRateLimiter(rdb *redis.Client, cfg RateLimitConfig) fiber.Handler {
	if cfg.Max <= 0 {
		cfg.Max = 100
	}
	if cfg.Window <= 0 {
		cfg.Window = time.Minute
	}
	if cfg.KeyGenerator == nil {
		cfg.KeyGenerator = func(c *fiber.Ctx) string { return c.IP() }
	}

	windowMicro := cfg.Window.Microseconds()

	return func(c *fiber.Ctx) error {
		ctx := context.Background()
		key := fmt.Sprintf("rl:%s", cfg.KeyGenerator(c))
		nowMicro := time.Now().UnixMicro()

		result, err := slidingWindowScript.Run(ctx, rdb, []string{key},
			nowMicro,
			windowMicro,
			cfg.Max,
		).Int64Slice()

		if err != nil {
			// If Redis is down, allow the request but log it.
			// This is a deliberate fail-open to avoid blocking all traffic
			// when the rate-limit backend is unreachable.
			return c.Next()
		}

		allowed := result[0] == 1
		remaining := result[1]
		resetMS := result[2]

		c.Set("X-RateLimit-Limit", strconv.Itoa(cfg.Max))
		c.Set("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
		c.Set("X-RateLimit-Reset", strconv.FormatInt(resetMS/1000, 10))

		if !allowed {
			retryAfter := time.Until(time.UnixMilli(resetMS))
			if retryAfter < 0 {
				retryAfter = time.Second
			}
			c.Set("Retry-After", strconv.Itoa(int(retryAfter.Seconds())+1))
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":       "rate limit exceeded",
				"retry_after": int(retryAfter.Seconds()) + 1,
			})
		}

		return c.Next()
	}
}
