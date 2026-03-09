from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, device_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[device_id].append(websocket)

    def disconnect(self, device_id: int, websocket: WebSocket) -> None:
        if websocket in self.active_connections.get(device_id, []):
            self.active_connections[device_id].remove(websocket)

    async def broadcast_to_device(self, device_id: int, payload: dict) -> None:
        dead = []
        for connection in self.active_connections.get(device_id, []):
            try:
                await connection.send_json(payload)
            except Exception:
                dead.append(connection)
        for conn in dead:
            self.disconnect(device_id, conn)


ws_manager = ConnectionManager()
