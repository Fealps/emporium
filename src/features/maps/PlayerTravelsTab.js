import React, { useState } from 'react';
import InteractiveMap from './InteractiveMap';

export default function PlayerTravelsTab({ game }) {
  const [selectedLocId, setSelectedLocId] = useState(null);

  const getTravelProgress = () => {
    if (!game.travelState) return 0;
    const elapsed = Date.now() - game.travelState.startTime;
    return Math.min(100, Math.floor((elapsed / game.travelState.durationMs) * 100));
  };

  const getRemainingTravelTime = () => {
    if (!game.travelState) return 0;
    const elapsed = Date.now() - game.travelState.startTime;
    const remainingMs = Math.max(0, game.travelState.durationMs - elapsed);
    return Math.ceil(remainingMs / 1000);
  };

  const activeLocation = (game.locations || []).find((l) => l.id === game.partyLocation);
  const targetLocation = game.travelState
    ? (game.locations || []).find((l) => l.id === game.travelState.to)
    : null;
  const selectedLocation = (game.locations || []).find((l) => l.id === selectedLocId) || activeLocation;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Map canvas */}
      <div className="lg:col-span-2 glass-panel p-4 flex flex-col">
        <h2 className="text-lg text-gold font-fantasy mb-3">Party Journey Map</h2>

        <InteractiveMap
          mapUrl={game.mapUrl}
          locations={game.locations || []}
          partyLocation={game.partyLocation}
          travelState={game.travelState}
          showPartyMarker={true}
          getTravelProgress={getTravelProgress}
          selectedLocId={selectedLocation?.id}
          onSelectLocId={(loc) => setSelectedLocId(loc.id)}
        />
      </div>

      {/* Travel sidebar */}
      <div className="glass-panel p-5 space-y-5 h-fit">
        <div>
          <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">
            Party Coordinates
          </h2>
          <div className="mt-3 space-y-2">
            <p className="text-sm">
              <span className="text-slate-400">Current Base:</span>{' '}
              <span className="font-fantasy text-amber-300">
                {activeLocation ? activeLocation.name : 'Unknown Wilderness'}
              </span>
            </p>
            <p className="text-xs text-slate-400 italic">
              "{activeLocation ? activeLocation.description : 'A mysterious area untouched by cartographers.'}"
            </p>
          </div>
        </div>

        {/* Landmark Lore inspection details */}
        {selectedLocation && (
          <div className="border border-white/5 bg-amber-950/10 p-4 rounded-lg space-y-2">
            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-widest font-fantasy">
              Selected Landmark
            </h3>
            <h4 className="text-sm font-fantasy text-slate-100">{selectedLocation.name}</h4>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {selectedLocation.description || 'No specific lore has been documented for this landmark.'}
            </p>
            <span className="text-[10px] text-slate-500 font-mono block">
              Coordinates: X: {selectedLocation.x}, Y: {selectedLocation.y}
            </span>
          </div>
        )}

        {/* Travel simulation progress widget */}
        <div className="border border-white/5 bg-black/20 p-4 rounded-lg space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Travel Indicator
          </h3>

          {game.travelState ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Moving to {targetLocation?.name}</span>
                <span className="text-amber-400 font-semibold">{getRemainingTravelTime()}s left</span>
              </div>

              <div className="travel-progress-bar">
                <div
                  className="travel-progress-fill"
                  style={{ width: `${getTravelProgress()}%` }}
                ></div>
              </div>

              <p className="text-md text-slate-400 italic">
                The Dungeon Master has set the coordinates. Hold fast, adventuring party is moving!
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Party is currently stationary. The DM determines travels.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
