package websocket

import (
	"encoding/json"
	"log"
	"time"

	fws "github.com/fasthttp/websocket"
	ws "github.com/gofiber/contrib/websocket"
)

const (
	// writeWait is the time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// pongWait is the time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// pingPeriod sends pings to the peer at this interval. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// maxMessageSize is the maximum size of an incoming WebSocket message.
	maxMessageSize = 4096

	// sendBufferSize is the size of the outgoing message channel.
	sendBufferSize = 256
)

// Client represents a single WebSocket connection. It sits between the Hub
// (which manages routing) and the underlying Gorilla-compatible WebSocket
// connection provided by Fiber.
type Client struct {
	hub  *Hub
	conn *ws.Conn

	// UserID of the authenticated user owning this connection.
	UserID string

	// subscriptions tracks the channels this client is subscribed to.
	subscriptions []string

	// send is a buffered channel of outbound messages.
	send chan []byte
}

// NewClient creates a new Client and registers it with the Hub.
func NewClient(hub *Hub, conn *ws.Conn, userID string) *Client {
	c := &Client{
		hub:    hub,
		conn:   conn,
		UserID: userID,
		send:   make(chan []byte, sendBufferSize),
	}
	hub.Register(c)
	return c
}

// ---------------------------------------------------------------------------
// Incoming messages
// ---------------------------------------------------------------------------

// incomingMessage is the JSON structure of messages received from the client.
type incomingMessage struct {
	Action  string `json:"action"`  // "subscribe", "unsubscribe"
	Channel string `json:"channel"` // e.g. "repo:uuid", "pr:uuid", "pipeline:uuid"
}

// ReadPump pumps messages from the WebSocket connection to the Hub. It runs in
// its own goroutine and must be started after creating the client.
//
// The application ensures there is at most one reader per connection by
// running ReadPump in a single goroutine.
func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)

	if err := c.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
		log.Printf("[ws] set read deadline: %v", err)
		return
	}

	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, msg, err := c.conn.ReadMessage()
		if err != nil {
			if fws.IsUnexpectedCloseError(err, fws.CloseGoingAway, fws.CloseAbnormalClosure, fws.CloseNormalClosure) {
				log.Printf("[ws] read error: user=%s err=%v", c.UserID, err)
			}
			break
		}

		c.HandleMessage(msg)
	}
}

// HandleMessage processes a single incoming WebSocket message. Supported
// actions are "subscribe" and "unsubscribe" for channel management.
func (c *Client) HandleMessage(msg []byte) {
	var incoming incomingMessage
	if err := json.Unmarshal(msg, &incoming); err != nil {
		c.sendError("invalid message format: " + err.Error())
		return
	}

	switch incoming.Action {
	case "subscribe":
		if incoming.Channel == "" {
			c.sendError("channel is required for subscribe")
			return
		}
		if !isValidChannel(incoming.Channel) {
			c.sendError("invalid channel format: " + incoming.Channel)
			return
		}
		c.hub.Subscribe(c, incoming.Channel)
		c.sendAck("subscribed", incoming.Channel)

	case "unsubscribe":
		if incoming.Channel == "" {
			c.sendError("channel is required for unsubscribe")
			return
		}
		c.hub.Unsubscribe(c, incoming.Channel)
		c.sendAck("unsubscribed", incoming.Channel)

	default:
		c.sendError("unknown action: " + incoming.Action)
	}
}

// ---------------------------------------------------------------------------
// Outgoing messages
// ---------------------------------------------------------------------------

// WritePump pumps messages from the send channel to the WebSocket connection.
// It runs in its own goroutine -- one per client.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				log.Printf("[ws] set write deadline: %v", err)
				return
			}
			if !ok {
				// Hub closed the channel.
				_ = c.conn.WriteMessage(fws.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(fws.TextMessage, message); err != nil {
				log.Printf("[ws] write error: user=%s err=%v", c.UserID, err)
				return
			}

			// Drain any queued messages to batch into a single write opportunity.
			n := len(c.send)
			for i := 0; i < n; i++ {
				queued, ok := <-c.send
				if !ok {
					return
				}
				if err := c.conn.WriteMessage(fws.TextMessage, queued); err != nil {
					log.Printf("[ws] write error: user=%s err=%v", c.UserID, err)
					return
				}
			}

		case <-ticker.C:
			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				log.Printf("[ws] set write deadline for ping: %v", err)
				return
			}
			if err := c.conn.WriteMessage(fws.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// sendAck sends an acknowledgement message back to the client.
func (c *Client) sendAck(action, channel string) {
	msg := WSEvent{
		Type: "ack",
		Payload: map[string]string{
			"action":  action,
			"channel": channel,
		},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case c.send <- data:
	default:
	}
}

// sendError sends an error message back to the client.
func (c *Client) sendError(message string) {
	msg := WSEvent{
		Type: "error",
		Payload: map[string]string{
			"message": message,
		},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case c.send <- data:
	default:
	}
}

// isValidChannel validates the format of a subscription channel name.
// Valid channels: "repo:<id>", "pr:<id>", "pipeline:<id>", "user:<id>".
func isValidChannel(channel string) bool {
	validPrefixes := []string{"repo:", "pr:", "pipeline:", "user:", "workspace:"}
	for _, prefix := range validPrefixes {
		if len(channel) > len(prefix) && channel[:len(prefix)] == prefix {
			return true
		}
	}
	return false
}
