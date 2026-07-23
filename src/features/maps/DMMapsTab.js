import React, { useState } from 'react';
import { db } from '../../utils/db';
import InteractiveMap from './InteractiveMap';

export default function DMMapsTab({ game, gameId, onRefresh }) {
  const [viewedMapId, setViewedMapId] = useState(game.activeMapId || 'map_default');
  const [selectedDMLocId, setSelectedDMLocId] = useState(null);
  
  // Landmark editing/creation state
  const [newLocName, setNewLocName] = useState('');
  const [newLocDesc, setNewLocDesc] = useState('');
  const [newLocX, setNewLocX] = useState(null);
  const [newLocY, setNewLocY] = useState(null);

  const [isEditingLandmark, setIsEditingLandmark] = useState(false);
  const [editLocName, setEditLocName] = useState('');
  const [editLocDesc, setEditLocDesc] = useState('');

  // Travel settings
  const [selectedTravelTarget, setSelectedTravelTarget] = useState('');
  const [travelDuration, setTravelDuration] = useState(30);

  const currentMaps = game.maps || [];
  const currentViewedMap = currentMaps.find((m) => m.id === viewedMapId) || {
    id: 'map_default',
    name: 'Phandalin Cartography',
    url: game.mapUrl,
    locations: game.locations || []
  };
  const viewedLocations = currentViewedMap.locations || [];
  const selectedLoc = viewedLocations.find((l) => l.id === selectedDMLocId);

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

  const handlePublishActiveMap = async (mapIdToPublish) => {
    try {
      await db.updateGameActiveMap(gameId, mapIdToPublish);
      const targetMap = (game.maps || []).find((m) => m.id === mapIdToPublish);
      await db.addLog(
        gameId,
        "Dungeon Master",
        `Published campaign active map: "${targetMap ? targetMap.name : mapIdToPublish}".`
      );
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to publish active map: ${e.message}`);
    }
  };

  const handleDeleteMap = async (mapIdToDelete, mapName) => {
    if (!window.confirm(`⚠️ Are you sure you want to delete map "${mapName}"?`)) return;
    try {
      const remainingMaps = (game.maps || []).filter((m) => m.id !== mapIdToDelete);
      let updatedActiveId = game.activeMapId;
      if (game.activeMapId === mapIdToDelete) {
        updatedActiveId = 'map_default';
      }
      await db.updateGameMaps(gameId, remainingMaps, updatedActiveId);
      await db.addLog(gameId, "Dungeon Master", `Deleted campaign map "${mapName}".`);
      setViewedMapId('map_default');
      setSelectedDMLocId(null);
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to delete map: ${e.message}`);
    }
  };

  const handleMapUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      alert("Only PNG map images are supported.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert("Map image size cannot exceed 25 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target.result;
      const customTitle = window.prompt("Enter a title for this map:", file.name.replace(/\.[^/.]+$/, ''));
      if (customTitle === null) return; // User cancelled

      const newMapId = "map_" + Math.floor(1000 + Math.random() * 9000);
      const newMapObj = {
        id: newMapId,
        name: customTitle.trim() || file.name,
        url: dataUrl,
        locations: []
      };

      try {
        const existingMaps = game.maps && game.maps.length > 0 ? game.maps : [
          {
            id: 'map_default',
            name: 'Phandalin Cartography',
            url: null,
            locations: game.locations || []
          }
        ];
        const updatedMaps = [...existingMaps, newMapObj];
        await db.updateGameMaps(gameId, updatedMaps, game.activeMapId || 'map_default');
        await db.addLog(gameId, "Dungeon Master", `Uploaded new custom map: "${newMapObj.name}".`);
        setViewedMapId(newMapId);
        if (onRefresh) onRefresh();
      } catch (err) {
        alert(`Failed to upload map image: ${err.message}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetMap = async () => {
    if (!window.confirm("Reset maps list to default?")) return;
    try {
      const defaultMaps = [
        {
          id: 'map_default',
          name: 'Phandalin Cartography',
          url: null,
          locations: game.locations || []
        }
      ];
      await db.updateGameMaps(gameId, defaultMaps, 'map_default');
      await db.addLog(gameId, "Dungeon Master", "Reset maps list to default Phandalin Cartography.");
      setViewedMapId('map_default');
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to reset map: ${e.message}`);
    }
  };

  const handleCreateLandmark = async (e) => {
    e.preventDefault();
    if (!newLocName.trim()) return;

    const newLandmark = {
      id: "loc_" + Math.floor(1000 + Math.random() * 9000),
      name: newLocName.trim(),
      description: newLocDesc.trim(),
      x: newLocX,
      y: newLocY
    };

    try {
      const existingMaps = game.maps && game.maps.length > 0 ? game.maps : [
        { id: 'map_default', name: 'Phandalin Cartography', url: game.mapUrl, locations: game.locations || [] }
      ];

      const updatedMaps = existingMaps.map((m) => {
        if (m.id === viewedMapId) {
          return { ...m, locations: [...(m.locations || []), newLandmark] };
        }
        return m;
      });

      let updatedLocations = game.locations;
      if (viewedMapId === 'map_default' || viewedMapId === game.activeMapId) {
        updatedLocations = [...(game.locations || []), newLandmark];
      }

      await db.updateGameLocationsAndMaps(gameId, updatedLocations, updatedMaps);
      await db.addLog(gameId, "Dungeon Master", `Established landmark "${newLandmark.name}" at (${newLocX}, ${newLocY}).`);
      
      setNewLocX(null);
      setNewLocY(null);
      setNewLocName('');
      setNewLocDesc('');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Failed to create landmark: ${err.message}`);
    }
  };

  const handleSaveLandmarkEdits = async (e) => {
    e.preventDefault();
    if (!editLocName.trim() || !selectedDMLocId) return;

    try {
      const existingMaps = game.maps && game.maps.length > 0 ? game.maps : [
        { id: 'map_default', name: 'Phandalin Cartography', url: game.mapUrl, locations: game.locations || [] }
      ];

      const updatedMaps = existingMaps.map((m) => {
        if (m.id === viewedMapId) {
          const nextLocs = (m.locations || []).map((l) => {
            if (l.id === selectedDMLocId) {
              return { ...l, name: editLocName.trim(), description: editLocDesc.trim() };
            }
            return l;
          });
          return { ...m, locations: nextLocs };
        }
        return m;
      });

      let updatedLocations = game.locations;
      if (viewedMapId === 'map_default' || viewedMapId === game.activeMapId) {
        updatedLocations = (game.locations || []).map((l) => {
          if (l.id === selectedDMLocId) {
            return { ...l, name: editLocName.trim(), description: editLocDesc.trim() };
          }
          return l;
        });
      }

      await db.updateGameLocationsAndMaps(gameId, updatedLocations, updatedMaps);
      await db.addLog(gameId, "Dungeon Master", `Updated landmark details for "${editLocName.trim()}".`);
      setIsEditingLandmark(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Failed to save landmark edits: ${err.message}`);
    }
  };

  const handleDeleteLocation = async (locId, locName) => {
    if (!window.confirm(`⚠️ Permanently delete landmark "${locName}"?`)) return;

    try {
      const existingMaps = game.maps && game.maps.length > 0 ? game.maps : [
        { id: 'map_default', name: 'Phandalin Cartography', url: game.mapUrl, locations: game.locations || [] }
      ];

      const updatedMaps = existingMaps.map((m) => {
        if (m.id === viewedMapId) {
          const nextLocs = (m.locations || []).filter((l) => l.id !== locId);
          return { ...m, locations: nextLocs };
        }
        return m;
      });

      let updatedLocations = (game.locations || []).filter((l) => l.id !== locId);
      let nextPartyLoc = game.partyLocation;
      if (game.partyLocation === locId) {
        nextPartyLoc = updatedLocations.length > 0 ? updatedLocations[0].id : 'loc_start';
      }

      await db.updateGameLocationsAndMaps(gameId, updatedLocations, updatedMaps, nextPartyLoc);
      await db.addLog(gameId, "Dungeon Master", `Deleted landmark "${locName}".`);
      if (selectedDMLocId === locId) setSelectedDMLocId(null);
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to delete landmark: ${e.message}`);
    }
  };

  const handleStartTravel = async () => {
    if (!selectedTravelTarget) return;
    const toLoc = game.locations.find((l) => l.id === selectedTravelTarget);
    if (!toLoc) return;

    const durationMs = (travelDuration || 30) * 1000;
    const travelStateObj = {
      from: game.partyLocation,
      to: selectedTravelTarget,
      startTime: Date.now(),
      durationMs
    };

    try {
      await db.updateGameTravel(gameId, { travelState: travelStateObj });
      await db.addLog(gameId, "Dungeon Master", `Dispatched party travel towards ${toLoc.name} (${travelDuration}s journey).`);
      setSelectedTravelTarget('');
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to start travel: ${e.message}`);
    }
  };

  const handleStartTravelToLoc = async (targetLocId, targetLocName) => {
    const durationMs = 30 * 1000;
    const travelStateObj = {
      from: game.partyLocation,
      to: targetLocId,
      startTime: Date.now(),
      durationMs
    };

    try {
      await db.updateGameTravel(gameId, { travelState: travelStateObj });
      await db.addLog(gameId, "Dungeon Master", `Set party travel destination to ${targetLocName}.`);
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to start travel: ${e.message}`);
    }
  };

  const handleCancelTravel = async () => {
    if (!window.confirm("Abort current party journey?")) return;
    try {
      await db.updateGameTravel(gameId, { travelState: null });
      await db.addLog(gameId, "Dungeon Master", "Aborted party travel journey.");
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to abort travel: ${e.message}`);
    }
  };

  const activeLocation = game.locations.find((l) => l.id === game.partyLocation);
  const targetLocation = game.travelState ? game.locations.find((l) => l.id === game.travelState.to) : null;

  return (
    <div className="space-y-4">
      {/* Map Selection header */}
      <div className="glass-panel p-3 flex flex-wrap items-center justify-between gap-3 border border-amber-500/10">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase font-bold text-slate-400 font-fantasy">Campaign Maps:</span>
          <select
            className="rpg-input rpg-select text-xs w-48"
            value={viewedMapId}
            onChange={(e) => {
              setViewedMapId(e.target.value);
              setSelectedDMLocId(null);
              setNewLocX(null);
              setNewLocY(null);
            }}
          >
            {(game.maps && game.maps.length > 0
              ? game.maps
              : [{ id: 'map_default', name: 'Phandalin Cartography' }]
            ).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {viewedMapId !== game.activeMapId ? (
            <button
              onClick={() => handlePublishActiveMap(viewedMapId)}
              className="rpg-btn rpg-btn-primary py-1 px-3 text-xs"
            >
              📣 Show to Players
            </button>
          ) : (
            <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded font-mono">
              ACTIVE (Visible to Players)
            </span>
          )}
        </div>

        {viewedMapId !== 'map_default' && (
          <button
            onClick={() => handleDeleteMap(viewedMapId, currentViewedMap.name)}
            className="rpg-btn rpg-btn-secondary py-1 px-2.5 text-xs border-rose-950 text-rose-400 hover:bg-rose-950/20"
          >
            Delete Map
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map canvas */}
        <div className="lg:col-span-2 glass-panel p-4 flex flex-col space-y-3">
          <div>
            <h2 className="text-lg text-gold font-fantasy">Campaign World Map</h2>
            <p className="text-xs text-slate-400">
              Click on any landmark to edit details, delete it, or set it as travel destination. Click on
              empty space to establish a new landmark.
            </p>
          </div>

          <InteractiveMap
            mapUrl={currentViewedMap.url}
            locations={viewedLocations}
            partyLocation={game.partyLocation}
            travelState={game.travelState}
            showPartyMarker={viewedMapId === game.activeMapId}
            getTravelProgress={getTravelProgress}
            selectedLocId={selectedDMLocId}
            onSelectLocId={(loc) => {
              setSelectedDMLocId(loc.id);
              setNewLocX(null);
              setNewLocY(null);
              setEditLocName(loc.name);
              setEditLocDesc(loc.description || '');
              setIsEditingLandmark(false);
            }}
            onClickMap={(x, y) => {
              setSelectedDMLocId(null);
              setIsEditingLandmark(false);
              setNewLocX(x);
              setNewLocY(y);
              setNewLocName('');
              setNewLocDesc('');
            }}
            draftPin={{ x: newLocX, y: newLocY }}
          />
        </div>

        {/* Map Details & Travel coordinator sidebar */}
        <div className="glass-panel p-5 space-y-5 h-fit">
          {selectedLoc ? (
            <div className="border border-white/5 bg-amber-950/10 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-widest font-fantasy">
                  Inspecting Landmark
                </h3>
                <button
                  onClick={() => setSelectedDMLocId(null)}
                  className="text-xs text-slate-400 hover:text-slate-200 bg-transparent border-none cursor-pointer"
                >
                  Deselect
                </button>
              </div>

              {isEditingLandmark ? (
                <form onSubmit={handleSaveLandmarkEdits} className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400">Landmark Name</label>
                    <input
                      type="text"
                      className="rpg-input text-xs"
                      value={editLocName}
                      onChange={(e) => setEditLocName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400">Lore / Description</label>
                    <textarea
                      className="rpg-input text-xs h-16 resize-none"
                      value={editLocDesc}
                      onChange={(e) => setEditLocDesc(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" className="rpg-btn rpg-btn-primary text-xs py-1 px-3 flex-1">
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingLandmark(false)}
                      className="rpg-btn rpg-btn-secondary text-xs py-1 px-3 flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2.5">
                  <h4 className="text-md font-fantasy text-white">{selectedLoc.name}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "{selectedLoc.description || 'No description recorded.'}"
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Coordinates: ({selectedLoc.x}, {selectedLoc.y})
                  </p>

                  <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                    {game.partyLocation !== selectedLoc.id && viewedMapId === game.activeMapId && (
                      <button
                        onClick={() => handleStartTravelToLoc(selectedLoc.id, selectedLoc.name)}
                        disabled={!!game.travelState}
                        className="rpg-btn rpg-btn-primary w-full py-1.5 text-xs"
                      >
                        🏹 Set as Travel Destination
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditLocName(selectedLoc.name);
                          setEditLocDesc(selectedLoc.description || '');
                          setIsEditingLandmark(true);
                        }}
                        className="rpg-btn rpg-btn-secondary text-xs py-1 flex-1 border-amber-500/20 text-amber-300"
                      >
                        ⚙ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(selectedLoc.id, selectedLoc.name)}
                        className="rpg-btn rpg-btn-secondary text-xs py-1 flex-1 border-rose-950 text-rose-400 hover:bg-rose-950/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : newLocX !== null && newLocY !== null ? (
            <div className="border border-white/5 bg-black/20 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
                  Establish Landmark
                </h3>
                <button
                  onClick={() => {
                    setNewLocX(null);
                    setNewLocY(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 bg-transparent border-none cursor-pointer font-bold ml-2"
                >
                  ×
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                You clicked on coordinates **X: {newLocX}, Y: {newLocY}** on **"{currentViewedMap.name}"**.
                Establish a new landmark or town at this location?
              </p>

              <form onSubmit={handleCreateLandmark} className="space-y-3 pt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Landmark Name</label>
                  <input
                    type="text"
                    className="rpg-input text-xs"
                    placeholder="e.g. Shadowdale"
                    value={newLocName}
                    onChange={(e) => setNewLocName(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Lore Description</label>
                  <textarea
                    className="rpg-input text-xs h-16 resize-none"
                    placeholder="Describe the city, landmarks, or secrets..."
                    value={newLocDesc}
                    onChange={(e) => setNewLocDesc(e.target.value)}
                  />
                </div>

                <button type="submit" className="rpg-btn rpg-btn-primary w-full py-1.5 text-xs">
                  ＋ Place Landmark
                </button>
              </form>
            </div>
          ) : (
            <div className="border border-white/5 bg-black/20 p-4 rounded-lg text-center text-xs text-slate-400 italic">
              💡 Select a landmark on the map to edit details or dispatch travel. Click empty space to add
              new cities.
            </div>
          )}

          {/* Map image settings */}
          <div className="border border-white/5 bg-black/20 p-4 rounded-lg space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Map Layouts</h3>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-slate-400">Upload new PNG map (max 25MB)</label>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/png"
                  className="rpg-input text-xs w-full"
                  onChange={handleMapUpload}
                />
                {game.maps && game.maps.length > 1 && (
                  <button
                    type="button"
                    onClick={handleResetMap}
                    className="rpg-btn rpg-btn-secondary text-xs py-1 px-3 border-rose-950 text-rose-400 hover:bg-rose-950/20"
                  >
                    Reset to Default Map List
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Party Status</h2>
            <div className="mt-3 space-y-2">
              <p className="text-sm">
                <span className="text-slate-400">Current Position:</span>{' '}
                <span className="font-fantasy text-amber-300">
                  {activeLocation ? activeLocation.name : 'Unknown Wilderness'}
                </span>
              </p>
              <p className="text-xs text-slate-400 italic font-medium">
                "{activeLocation ? activeLocation.description : 'A mysterious area untouched by cartographers.'}"
              </p>
            </div>
          </div>

          {/* Travel simulation progress widget */}
          {game.travelState && (
            <div className="border border-white/5 bg-rose-950/15 p-4 rounded-lg space-y-3">
              <h3 className="text-xs font-semibold text-rose-300 uppercase tracking-widest">
                Active Travel Journey
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span>Traveling to {targetLocation?.name}</span>
                  <span className="text-amber-400 font-semibold">{getRemainingTravelTime()}s remaining</span>
                </div>

                <div className="travel-progress-bar">
                  <div
                    className="travel-progress-fill"
                    style={{ width: `${getTravelProgress()}%` }}
                  ></div>
                </div>

                <button
                  onClick={handleCancelTravel}
                  className="rpg-btn rpg-btn-secondary w-full py-1 text-xs text-rose-400 border-rose-950/40 hover:bg-rose-950/20"
                >
                  Abort Travel Journey
                </button>
              </div>
            </div>
          )}

          {/* Quick Travel form */}
          {!selectedLoc && !game.travelState && (
            <div className="border border-white/5 bg-black/20 p-4 rounded-lg space-y-4">
              <h3 className="text-sm text-gold font-fantasy">Dispatch Party Travel</h3>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Destination</label>
                  <select
                    className="rpg-input rpg-select text-xs w-full"
                    value={selectedTravelTarget}
                    onChange={(e) => setSelectedTravelTarget(e.target.value)}
                  >
                    <option value="">-- Select Destination --</option>
                    {game.locations
                      .filter((l) => l.id !== game.partyLocation)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Travel Speed / Time (seconds)</label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    className="rpg-input text-xs w-full"
                    value={travelDuration}
                    onChange={(e) => setTravelDuration(Number(e.target.value) || 10)}
                  />
                </div>

                <button
                  onClick={handleStartTravel}
                  disabled={!selectedTravelTarget}
                  className="rpg-btn rpg-btn-primary w-full py-2 text-xs"
                >
                  🏹 Set Party in Motion
                </button>
              </div>
            </div>
          )}

          {/* List coordinates/nodes info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-1">
              Known Locations
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {viewedLocations.map((loc) => (
                <div
                  key={loc.id}
                  className="text-xs p-2 bg-white/5 rounded border border-white/5 flex justify-between items-center"
                >
                  <div>
                    <span className="font-fantasy text-slate-200 block">{loc.name}</span>
                    <span className="text-[10px] text-slate-400 italic max-w-[180px] block truncate">
                      {loc.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">
                      ({loc.x}, {loc.y})
                    </span>
                    <button
                      onClick={() => handleDeleteLocation(loc.id, loc.name)}
                      className="text-rose-500 hover:text-rose-300 text-xs font-bold leading-none bg-transparent border-none cursor-pointer"
                      title="Delete landmark"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
