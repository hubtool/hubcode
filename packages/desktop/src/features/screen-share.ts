import { randomUUID } from "node:crypto";
import { BrowserWindow, desktopCapturer, ipcMain, session } from "electron";
import log from "electron-log/main";

// Electron does not implement `navigator.mediaDevices.getDisplayMedia()` by
// default — calling it from the renderer resolves with no track unless the
// main process registers a handler that picks a source. LiveKit's screen-share
// TrackToggle calls getDisplayMedia under the hood, so without this the button
// is a silent no-op.
//
// We deliberately don't use `useSystemPicker: true`. The macOS native picker
// (SCContentSharingPicker) honors the `displaySurface` constraint LiveKit
// sends, which defaults to "monitor" — that hides individual windows from the
// user. Going through `desktopCapturer` + a custom in-app picker lets the user
// pick screens AND windows regardless of what LiveKit asked for.

// Electron's type forces a non-optional Streams argument, but at runtime
// passing `{}` for a video request throws "Video was requested, but no video
// stream was provided". Calling with no args is the documented way to deny —
// we widen the type so we can do that without casts everywhere.
type DisplayMediaCallback = (response?: { video?: Electron.DesktopCapturerSource }) => void;

type PendingPicker = {
  callback: DisplayMediaCallback;
  sources: Electron.DesktopCapturerSource[];
};

const pending = new Map<string, PendingPicker>();

const PICKER_EVENT = "hubcode:event:screen-share-picker";
const RESOLVE_CHANNEL = "hubcode:screen-share:resolve";

export function registerScreenShareHandler(): void {
  ipcMain.handle(
    RESOLVE_CHANNEL,
    (_event, args: { requestId: string; sourceId: string | null }) => {
      const entry = pending.get(args.requestId);
      if (!entry) return;
      pending.delete(args.requestId);
      if (!args.sourceId) {
        entry.callback();
        return;
      }
      const source = entry.sources.find((s) => s.id === args.sourceId);
      if (!source) {
        entry.callback();
        return;
      }
      entry.callback({ video: source });
    },
  );

  session.defaultSession.setDisplayMediaRequestHandler((_request, rawCallback) => {
    const callback = rawCallback as DisplayMediaCallback;
    desktopCapturer
      .getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 180 },
      })
      .then((sources) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (!win || sources.length === 0) {
          callback();
          return;
        }
        const requestId = randomUUID();
        pending.set(requestId, { callback, sources });
        win.webContents.send(PICKER_EVENT, {
          requestId,
          sources: sources.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.id.startsWith("screen:") ? "screen" : "window",
            thumbnailDataUrl: s.thumbnail.toDataURL(),
            appIconDataUrl: s.appIcon ? s.appIcon.toDataURL() : null,
          })),
        });
      })
      .catch((err) => {
        log.error("[screen-share] desktopCapturer.getSources failed", err);
        callback();
      });
  });
}
