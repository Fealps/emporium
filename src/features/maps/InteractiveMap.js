import React from 'react';
import fantasyMap from '../../assets/fantasymap.png';

export default function InteractiveMap({
  mapUrl,
  locations = [],
  partyLocation,
  travelState,
  showPartyMarker,
  getTravelProgress,
  selectedLocId,
  onSelectLocId,
  onClickMap,
  draftPin
}) {
  return (
    <div
      className="map-container relative cursor-crosshair"
      style={{ backgroundImage: `url(${mapUrl || fantasyMap})` }}
      onClick={(e) => {
        if (!onClickMap) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);
        onClickMap(x, y);
      }}
    >
      {/* Place nodes */}
      {locations.map((loc) => {
        const isActive = partyLocation === loc.id && showPartyMarker;
        const isSelected = selectedLocId === loc.id;
        return (
          <div
            key={loc.id}
            className={`map-node ${isActive ? 'active' : ''} ${
              isSelected ? 'border-amber-400 scale-110 shadow-lg' : ''
            } cursor-pointer`}
            style={{ left: `${loc.x}px`, top: `${loc.y}px` }}
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectLocId) {
                onSelectLocId(loc);
              }
            }}
            title={`${loc.name}: ${loc.description}`}
          >
            <div className="map-node-inner"></div>
            <div className="map-node-label">{loc.name}</div>
          </div>
        );
      })}

      {/* Glowing party traveler icon */}
      {travelState && showPartyMarker && (
        <div
          className="map-party-indicator animate-bounce"
          style={{
            left: `${(() => {
              const fromLoc = locations.find((l) => l.id === travelState.from);
              const toLoc = locations.find((l) => l.id === travelState.to);
              const progress = getTravelProgress() / 100;
              return fromLoc ? fromLoc.x + (toLoc.x - fromLoc.x) * progress : 0;
            })()}px`,
            top: `${(() => {
              const fromLoc = locations.find((l) => l.id === travelState.from);
              const toLoc = locations.find((l) => l.id === travelState.to);
              const progress = getTravelProgress() / 100;
              return fromLoc ? fromLoc.y + (toLoc.y - fromLoc.y) * progress : 0;
            })()}px`
          }}
        >
          ⛺
        </div>
      )}

      {/* Temporary pin when clicking empty space */}
      {draftPin && draftPin.x !== null && draftPin.y !== null && (
        <div
          className="absolute w-3 h-3 bg-amber-400 border border-black rounded-full animate-ping pointer-events-none"
          style={{ left: `${draftPin.x - 6}px`, top: `${draftPin.y - 6}px` }}
        />
      )}
    </div>
  );
}
