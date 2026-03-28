package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

// WSEvent is the envelope for all WebSocket messages sent to clients.
type WSEvent struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// Hub maintains the set of active WebSocket clients and broadcasts events
// to the appropriate recipients. Clients are indexed by user ID so that
// events can be targeted to specific users, and by subscription channel
// (e.g. "repo:<id>", "pr:<id>", "pipeline:<id>") for fan-out.
type Hub struct {
	// clients maps userID -> set of connected Client instances.
	clients map[string]map[*Client]bool

	// subscriptions maps channel name -> set of subscribed Clients.
	subscriptions map[string]map[*Client]bool

	// register requests from clients.
	register chan *Client

	// unregister requests from clients.
	unregister chan *Client

	// subscribe requests: client wants to join a channel.
	subscribe chan subscribeRequest

	// unsubscribeReq requests: client wants to leave a channel.
	unsubscribeReq chan subscribeRequest

	// broadcast sends an event to all clients subscribed to a channel.
	broadcast chan broadcastRequest

	// userSend sends an event to all connections of a specific user.
	userSend chan userSendRequest

	mu sync.RWMutex
}

type subscribeRequest struct {
	client  *Client
	channel string
}

type broadcastRequest struct {
	channel string
	event   WSEvent
}

type userSendRequest struct {
	userID string
	event  WSEvent
}

// NewHub creates and returns a new Hub.
func NewHub() *Hub {
	return &Hub{
		clients:        make(map[string]map[*Client]bool),
		subscriptions:  make(map[string]map[*Client]bool),
		register:       make(chan *Client, 64),
		unregister:     make(chan *Client, 64),
		subscribe:      make(chan subscribeRequest, 64),
		unsubscribeReq: make(chan subscribeRequest, 64),
		broadcast:      make(chan broadcastRequest, 256),
		userSend:       make(chan userSendRequest, 256),
	}
}

// Run starts the hub's main event loop. This must be called in a dedicated
// goroutine: go hub.Run()
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.addClient(client)

		case client := <-h.unregister:
			h.removeClient(client)

		case req := <-h.subscribe:
			h.addSubscription(req.client, req.channel)

		case req := <-h.unsubscribeReq:
			h.removeSubscription(req.client, req.channel)

		case req := <-h.broadcast:
			h.doBroadcast(req.channel, req.event)

		case req := <-h.userSend:
			h.doUserSend(req.userID, req.event)
		}
	}
}

// Register adds a client to the hub. Safe to call from any goroutine.
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister removes a client from the hub. Safe to call from any goroutine.
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// Subscribe subscribes a client to a channel.
func (h *Hub) Subscribe(client *Client, channel string) {
	h.subscribe <- subscribeRequest{client: client, channel: channel}
}

// Unsubscribe removes a client from a channel.
func (h *Hub) Unsubscribe(client *Client, channel string) {
	h.unsubscribeReq <- subscribeRequest{client: client, channel: channel}
}

// SendToUser sends an event to all WebSocket connections belonging to a
// specific user.
func (h *Hub) SendToUser(userID string, event WSEvent) {
	h.userSend <- userSendRequest{userID: userID, event: event}
}

// BroadcastToChannel sends an event to all clients subscribed to the given
// channel (e.g. "repo:uuid", "pr:uuid", "pipeline:uuid").
func (h *Hub) BroadcastToChannel(channel string, event WSEvent) {
	h.broadcast <- broadcastRequest{channel: channel, event: event}
}

// BroadcastToRepo is a convenience method for broadcasting to a repository
// channel.
func (h *Hub) BroadcastToRepo(repoID string, event WSEvent) {
	h.BroadcastToChannel("repo:"+repoID, event)
}

// BroadcastToPR is a convenience method for broadcasting to a pull-request
// channel.
func (h *Hub) BroadcastToPR(prID string, event WSEvent) {
	h.BroadcastToChannel("pr:"+prID, event)
}

// BroadcastToPipeline is a convenience method for broadcasting to a pipeline
// channel.
func (h *Hub) BroadcastToPipeline(pipelineID string, event WSEvent) {
	h.BroadcastToChannel("pipeline:"+pipelineID, event)
}

// ClientCount returns the total number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	count := 0
	for _, conns := range h.clients {
		count += len(conns)
	}
	return count
}

// ---------------------------------------------------------------------------
// Internal methods (called only from the Run loop -- no lock needed for maps,
// but we use the mutex for ClientCount which can be called from outside).
// ---------------------------------------------------------------------------

func (h *Hub) addClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.clients[client.UserID] == nil {
		h.clients[client.UserID] = make(map[*Client]bool)
	}
	h.clients[client.UserID][client] = true

	log.Printf("[ws] client registered: user=%s, total=%d", client.UserID, h.clientCountLocked())
}

func (h *Hub) removeClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Remove from user map.
	if conns, ok := h.clients[client.UserID]; ok {
		delete(conns, client)
		if len(conns) == 0 {
			delete(h.clients, client.UserID)
		}
	}

	// Remove from all subscriptions.
	for _, ch := range client.subscriptions {
		if subs, ok := h.subscriptions[ch]; ok {
			delete(subs, client)
			if len(subs) == 0 {
				delete(h.subscriptions, ch)
			}
		}
	}

	// Close the send channel to signal WritePump to exit.
	close(client.send)

	log.Printf("[ws] client unregistered: user=%s, total=%d", client.UserID, h.clientCountLocked())
}

func (h *Hub) addSubscription(client *Client, channel string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.subscriptions[channel] == nil {
		h.subscriptions[channel] = make(map[*Client]bool)
	}
	h.subscriptions[channel][client] = true
	client.subscriptions = appendUnique(client.subscriptions, channel)

	log.Printf("[ws] client subscribed: user=%s channel=%s", client.UserID, channel)
}

func (h *Hub) removeSubscription(client *Client, channel string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if subs, ok := h.subscriptions[channel]; ok {
		delete(subs, client)
		if len(subs) == 0 {
			delete(h.subscriptions, channel)
		}
	}
	client.subscriptions = removeItem(client.subscriptions, channel)
}

func (h *Hub) doBroadcast(channel string, event WSEvent) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	subs, ok := h.subscriptions[channel]
	if !ok {
		return
	}

	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("[ws] marshal broadcast event: %v", err)
		return
	}

	for client := range subs {
		select {
		case client.send <- data:
		default:
			// Client's send buffer is full; drop the message.
			log.Printf("[ws] dropping message for slow client: user=%s", client.UserID)
		}
	}
}

func (h *Hub) doUserSend(userID string, event WSEvent) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	conns, ok := h.clients[userID]
	if !ok {
		return
	}

	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("[ws] marshal user event: %v", err)
		return
	}

	for client := range conns {
		select {
		case client.send <- data:
		default:
			log.Printf("[ws] dropping message for slow client: user=%s", client.UserID)
		}
	}
}

func (h *Hub) clientCountLocked() int {
	count := 0
	for _, conns := range h.clients {
		count += len(conns)
	}
	return count
}

// ---------------------------------------------------------------------------
// Slice helpers
// ---------------------------------------------------------------------------

func appendUnique(slice []string, item string) []string {
	for _, s := range slice {
		if s == item {
			return slice
		}
	}
	return append(slice, item)
}

func removeItem(slice []string, item string) []string {
	for i, s := range slice {
		if s == item {
			return append(slice[:i], slice[i+1:]...)
		}
	}
	return slice
}
