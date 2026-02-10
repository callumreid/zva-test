"use client";

import { useEffect, useState } from "react";

type ZvaSdkEvent =
  | "open"
  | "close"
  | "show"
  | "hide"
  | "engagement_started"
  | "engagement_ended";

interface ZvaSdk {
  show: () => void;
  hide: () => void;
  close: () => void;
  endChat: () => void;
  waitForInit: () => Promise<void>;
  waitForReady: () => Promise<void>;
  ChangeCampaign: (id: string, channel?: string) => void;
  updateUserContext: () => void;
  on: (event: ZvaSdkEvent, callback: () => void) => void;
}

declare global {
  interface Window {
    zoomCampaignSdk?: ZvaSdk;
    zoomCampaignSdkConfig?: {
      env: string;
      apikey: string;
    };
  }
}

export default function ZvaChat() {
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "no-config"
  >("loading");
  const [events, setEvents] = useState<string[]>([]);

  const apiKey = process.env.NEXT_PUBLIC_ZVA_API_KEY;
  const env = process.env.NEXT_PUBLIC_ZVA_ENV || "us01";
  const entryId = process.env.NEXT_PUBLIC_ZVA_ENTRY_ID;

  useEffect(() => {
    if (!apiKey && !entryId) {
      setStatus("no-config");
      return;
    }

    const addEvent = (event: string) => {
      setEvents((prev) => [
        ...prev.slice(-19),
        `${new Date().toLocaleTimeString()} - ${event}`,
      ]);
    };

    // Set global config for jQuery compatibility
    if (apiKey) {
      window.zoomCampaignSdkConfig = { env, apikey: apiKey };
    }

    // Load the SDK script
    const script = document.createElement("script");

    if (apiKey) {
      script.setAttribute("data-apikey", apiKey);
      script.setAttribute("data-env", env);
    }
    if (entryId) {
      script.setAttribute("data-chat-entry-id", entryId);
    }

    script.src = `https://${env}ccistatic.zoom.us/${env}cci/web-sdk/zcc-sdk.js`;
    script.async = true;

    script.onload = () => {
      addEvent("SDK script loaded");

      // Wait for SDK to initialize
      const checkSdk = setInterval(() => {
        if (window.zoomCampaignSdk) {
          clearInterval(checkSdk);
          const sdk = window.zoomCampaignSdk;

          // Register event listeners
          const sdkEvents: ZvaSdkEvent[] = [
            "open",
            "close",
            "show",
            "hide",
            "engagement_started",
            "engagement_ended",
          ];

          sdkEvents.forEach((event) => {
            sdk.on(event, () => addEvent(`Event: ${event}`));
          });

          sdk
            .waitForReady()
            .then(() => {
              setStatus("ready");
              addEvent("SDK ready");
            })
            .catch(() => {
              setStatus("error");
              addEvent("SDK failed to become ready");
            });
        }
      }, 500);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkSdk);
        if (status === "loading") {
          setStatus("error");
          addEvent("SDK initialization timed out");
        }
      }, 30000);
    };

    script.onerror = () => {
      setStatus("error");
      addEvent("Failed to load SDK script");
    };

    document.body.appendChild(script);

    return () => {
      // Cleanup
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, env, entryId]);

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Status Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          ZVA Widget Status
        </h2>

        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${
              status === "ready"
                ? "bg-green-500"
                : status === "loading"
                  ? "animate-pulse bg-yellow-500"
                  : status === "no-config"
                    ? "bg-zinc-400"
                    : "bg-red-500"
            }`}
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {status === "ready" && "Connected - Chat widget is active"}
            {status === "loading" && "Loading SDK..."}
            {status === "error" && "Error - Check console for details"}
            {status === "no-config" && "No API key configured"}
          </span>
        </div>

        {status === "no-config" && (
          <div className="mt-4 rounded-md bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-medium">Configuration needed</p>
            <p className="mt-1">
              Set <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">NEXT_PUBLIC_ZVA_API_KEY</code> in
              your <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">.env.local</code> file with your
              Zoom Virtual Agent Campaign API key.
            </p>
          </div>
        )}

        {/* Configuration Display */}
        <div className="mt-4 space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
          <div className="flex justify-between">
            <span>Environment:</span>
            <code className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {env}
            </code>
          </div>
          <div className="flex justify-between">
            <span>API Key:</span>
            <code className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {apiKey ? `${apiKey.slice(0, 8)}...` : "not set"}
            </code>
          </div>
          <div className="flex justify-between">
            <span>Entry ID:</span>
            <code className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {entryId || "not set"}
            </code>
          </div>
          <div className="flex justify-between">
            <span>Mode:</span>
            <code className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {apiKey ? "Campaign" : entryId ? "Entry ID" : "none"}
            </code>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Event Log
        </h2>
        <div className="max-h-48 overflow-y-auto rounded-md bg-zinc-50 p-3 font-mono text-xs dark:bg-zinc-950">
          {events.length === 0 ? (
            <span className="text-zinc-400">Waiting for events...</span>
          ) : (
            events.map((event, i) => (
              <div
                key={i}
                className="text-zinc-600 dark:text-zinc-400"
              >
                {event}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
