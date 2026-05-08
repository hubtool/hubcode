import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Monitor, AppWindow, X } from "lucide-react-native";
import { getDesktopHost } from "@/desktop/host";
import { Fonts } from "@/constants/theme";

const FONT_FAMILY =
  (Fonts as { sans?: string } | undefined)?.sans ??
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

type Source = {
  id: string;
  name: string;
  type: "screen" | "window";
  thumbnailDataUrl: string;
  appIconDataUrl: string | null;
};

type PickerEvent = {
  requestId: string;
  sources: Source[];
};

// Renders the source chooser when the Electron main process asks for one.
// Mounted once at the app root; idle (returns null) until an event arrives.
export function ScreenSharePicker() {
  const [request, setRequest] = useState<PickerEvent | null>(null);
  const [tab, setTab] = useState<"screen" | "window">("screen");

  useEffect(() => {
    const host = getDesktopHost();
    if (!host?.events?.on) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    Promise.resolve(
      host.events.on("screen-share-picker", (payload) => {
        const evt = payload as PickerEvent;
        setRequest(evt);
        setTab(evt.sources.some((s) => s.type === "screen") ? "screen" : "window");
      }),
    ).then((fn) => {
      if (cancelled) fn();
      else unsub = fn;
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const resolve = (sourceId: string | null) => {
    if (!request) return;
    const host = getDesktopHost();
    void host?.screenShare?.resolve?.({ requestId: request.requestId, sourceId });
    setRequest(null);
  };

  if (!request || typeof document === "undefined") return null;

  const filtered = request.sources.filter((s) => s.type === tab);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => resolve(null)}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 90vw)",
          maxHeight: "80vh",
          background: "rgba(15,15,17,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#fafafa" }}>
            Choose what to share
          </span>
          <button
            type="button"
            onClick={() => resolve(null)}
            aria-label="Cancel"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} color="#a1a1aa" />
          </button>
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "8px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <TabButton
            active={tab === "screen"}
            onClick={() => setTab("screen")}
            icon={<Monitor size={14} color={tab === "screen" ? "#fff" : "#a1a1aa"} />}
            label={`Screens (${request.sources.filter((s) => s.type === "screen").length})`}
          />
          <TabButton
            active={tab === "window"}
            onClick={() => setTab("window")}
            icon={<AppWindow size={14} color={tab === "window" ? "#fff" : "#a1a1aa"} />}
            label={`Windows (${request.sources.filter((s) => s.type === "window").length})`}
          />
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
            background: "#09090b",
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "32px 16px",
                textAlign: "center",
                color: "#71717a",
                fontSize: 12,
              }}
            >
              {tab === "window"
                ? "No windows available. Make sure the app you want to share has a visible window."
                : "No screens available."}
            </div>
          ) : (
            filtered.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => resolve(source.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: 8,
                  background: "rgba(39,39,42,0.6)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 120ms ease, border-color 120ms ease",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(63,63,70,0.8)";
                  e.currentTarget.style.borderColor = "rgba(196,25,139,0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(39,39,42,0.6)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                }}
              >
                <img
                  src={source.thumbnailDataUrl}
                  alt={source.name}
                  style={{
                    width: "100%",
                    aspectRatio: "16/9",
                    objectFit: "contain",
                    background: "#000",
                    borderRadius: 6,
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  {source.appIconDataUrl ? (
                    <img
                      src={source.appIconDataUrl}
                      alt=""
                      style={{ width: 14, height: 14, flexShrink: 0 }}
                    />
                  ) : null}
                  <span
                    style={{
                      fontSize: 11,
                      color: "#e4e4e7",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {source.name}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 8,
        background: active ? "rgba(196,25,139,0.18)" : "transparent",
        border: active ? "1px solid rgba(196,25,139,0.4)" : "1px solid transparent",
        color: active ? "#fff" : "#a1a1aa",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
