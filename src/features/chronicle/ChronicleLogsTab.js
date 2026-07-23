import React from 'react';
import { db } from '../../utils/db';

export default function ChronicleLogsTab({ logs = [], gameId, isDM, onRefresh }) {
  const handleClearLogs = async () => {
    try {
      await db.addLog(gameId, "Dungeon Master", "Cleared the scrolls.");
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to clear logs:", e);
    }
  };

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <h2 className="text-lg text-gold font-fantasy">
          {isDM ? "Campaign Log Ticker" : "Chronicled Logs"}
        </h2>
        {isDM && (
          <button
            onClick={handleClearLogs}
            className="rpg-btn rpg-btn-secondary py-1 text-[11px]"
          >
            Clear Logs
          </button>
        )}
      </div>

      <div className="bg-black/30 p-4 rounded-lg border border-white/5 h-96 overflow-y-auto font-mono text-xs space-y-2 flex flex-col-reverse">
        {[...logs].reverse().map((log, index) => {
          let logClass = 'log-system';
          if (log.sender === 'Dungeon Master') logClass = 'log-dm';
          else if (log.sender !== 'System') logClass = 'log-player';

          return (
            <div key={index} className={`log-entry ${logClass}`}>
              <span className="text-slate-500">[{log.timestamp}]</span>{" "}
              <span className="text-amber-300 font-semibold">{log.sender}:</span>{" "}
              <span className="text-slate-300">{log.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
