# Server Side Data Model

# Snippet
1) Each Room must have 1 Router and related peers to that router.
```
Room {
  router
  peers: Map<peerId, Peer>
}

```

2) Peers Info
    - Peer must have socketConnection,producers,trasnports,consumers.
        - transport have key pair with transportId as a key and transport as a value.
        - producer have key pair with producerId as a key and producer as a value.
        - consumer have key pair with consumerId as a key and consumer as a value.

    ```

    Peer {
    socket
    transports: Map<transportId, Transport>
    producers: Map<producerId, Producer>
    consumers: Map<consumerId, Consumer>
    }

    ```

    # Why
    - Each peer has its own transports
    - Each peer can produce multiple tracks 
    - Each peer consumes many producers


3) Creating a New Peer.
    - Create a Peer Object
    - store it in the room

    ```
    peers.set(ws.id,{
        transports : new Map(),
        producers : new Map(),
        consumers : new Map()
    })


    ```
