package middleware

import (
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
)

// RequestLogger returns a Fiber middleware that logs every request with method,
// path, status code, latency, and client IP.
func RequestLogger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Process the request.
		err := c.Next()

		latency := time.Since(start)
		status := c.Response().StatusCode()
		method := c.Method()
		path := c.Path()
		ip := c.IP()
		userID := GetUserID(c) // empty string if unauthenticated

		logLine := fmt.Sprintf("[http] %s %s -> %d | %v | ip=%s",
			method, path, status, latency.Round(time.Microsecond), ip)

		if userID != "" {
			logLine += fmt.Sprintf(" | user=%s", userID)
		}

		if queryStr := c.Request().URI().QueryString(); len(queryStr) > 0 {
			logLine += fmt.Sprintf(" | query=%s", string(queryStr))
		}

		if err != nil {
			logLine += fmt.Sprintf(" | error=%v", err)
		}

		if status >= 500 {
			log.Printf("ERROR %s", logLine)
		} else if status >= 400 {
			log.Printf("WARN  %s", logLine)
		} else {
			log.Printf("INFO  %s", logLine)
		}

		return err
	}
}
