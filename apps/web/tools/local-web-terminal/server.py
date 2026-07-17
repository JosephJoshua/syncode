#!/usr/bin/env python3
import argparse
import asyncio
import fcntl
import json
import os
import pty
import signal
import struct
import termios
from pathlib import Path

from aiohttp import WSMsgType, web


ROOT = Path(__file__).resolve().parent


def resize_pty(fd: int, rows: int, cols: int) -> None:
    rows = max(1, min(int(rows), 200))
    cols = max(1, min(int(cols), 400))
    packed = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, packed)


def token_is_valid(request: web.Request) -> bool:
    expected = os.environ.get("COMMAND_PANEL_TOKEN")
    if not expected:
        return True

    supplied = request.query.get("token")
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        supplied = auth.removeprefix("Bearer ").strip()

    return supplied == expected


async def index(request: web.Request) -> web.Response:
    return web.FileResponse(ROOT / "static" / "index.html")


async def websocket_terminal(request: web.Request) -> web.WebSocketResponse:
    if not token_is_valid(request):
        raise web.HTTPUnauthorized(text="Missing or invalid token")

    ws = web.WebSocketResponse(heartbeat=20)
    await ws.prepare(request)

    shell = request.app["shell"]
    cwd = request.app["cwd"]
    env = os.environ.copy()
    env.setdefault("TERM", "xterm-256color")
    env.setdefault("COLORTERM", "truecolor")

    child_pid, master_fd = pty.fork()
    if child_pid == 0:
        try:
            os.chdir(cwd)
            os.execvpe(shell, [shell], env)
        except OSError as exc:
            os.write(2, f"Failed to start shell: {exc}\n".encode())
            os._exit(127)

    os.set_blocking(master_fd, False)

    loop = asyncio.get_running_loop()
    closed = asyncio.Event()

    async def send_output() -> None:
        while not closed.is_set():
            try:
                data = await loop.run_in_executor(None, os.read, master_fd, 4096)
            except BlockingIOError:
                await asyncio.sleep(0.01)
                continue
            except OSError:
                break

            if not data:
                break

            await ws.send_str(data.decode("utf-8", errors="replace"))

    output_task = asyncio.create_task(send_output())

    try:
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                continue

            try:
                payload = json.loads(msg.data)
            except json.JSONDecodeError:
                os.write(master_fd, msg.data.encode())
                continue

            kind = payload.get("type")
            if kind == "input":
                os.write(master_fd, payload.get("data", "").encode())
            elif kind == "resize":
                resize_pty(master_fd, payload.get("rows", 24), payload.get("cols", 80))
    finally:
        closed.set()
        output_task.cancel()
        try:
            os.killpg(child_pid, signal.SIGHUP)
        except ProcessLookupError:
            pass
        except PermissionError:
            os.kill(child_pid, signal.SIGHUP)
        except OSError:
            try:
                os.kill(child_pid, signal.SIGHUP)
            except ProcessLookupError:
                pass
        try:
            os.close(master_fd)
        except OSError:
            pass
        try:
            os.waitpid(child_pid, os.WNOHANG)
        except ChildProcessError:
            pass

    return ws


def build_app(shell: str, cwd: str) -> web.Application:
    app = web.Application()
    app["shell"] = shell
    app["cwd"] = cwd
    app.router.add_get("/", index)
    app.router.add_get("/ws", websocket_terminal)
    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Local browser terminal for Linux.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", default=8080, type=int)
    parser.add_argument("--shell", default=os.environ.get("SHELL", "/bin/bash"))
    parser.add_argument("--cwd", default=os.getcwd())
    args = parser.parse_args()

    print(f"Serving terminal on http://{args.host}:{args.port}")
    print(f"Shell: {args.shell}")
    print(f"Working directory: {args.cwd}")
    if os.environ.get("COMMAND_PANEL_TOKEN"):
        print("Token auth: enabled")
    else:
        print("Token auth: disabled")

    web.run_app(build_app(args.shell, args.cwd), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
