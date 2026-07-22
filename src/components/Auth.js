import React, { useState } from 'react';
import { db } from '../utils/db';

export default function Auth({ onAuthSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const userVal = username.trim();
    const passVal = password.trim();

    if (!userVal || !passVal) {
      setError("Please fill in all fields.");
      return;
    }

    if (isRegistering) {
      const res = await db.register(userVal, passVal);
      if (res.success) {
        onAuthSuccess(res.username);
      } else {
        setError(res.error);
      }
    } else {
      const res = await db.login(userVal, passVal);
      if (res.success) {
        onAuthSuccess(res.username);
      } else {
        setError(res.error);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black/40">
      <div className="glass-panel max-w-md w-30 p-8 fade-in relative overflow-hidden border-t-4 border-t-amber-500">

        {/* Subtle glowing ring background decoration */}
        <div className="absolute -top-24 -left-24 w-48 height-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 height-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none"></div>

        <div className="text-center mb-8">
          <h1 className="text-3xl text-gold mb-2 font-fantasy">Adventurer's Emporium</h1>
          <p className="text-sm text-slate-400">
            {isRegistering
              ? "Create your chronicle and prepare for travels."
              : "Step inside, sign the register, and buy your gear."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="tc-wrap space-y-5">
          {error && (
            <div className="bg-rose-950/40 border border-rose-800 text-rose-300 text-sm px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Adventurer Name (Username)
            </label>
            <input
              type="text"
              className="rpg-input w-full"
              placeholder="e.g. Alandor, Grog"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Passkey (Password)
            </label>
            <input
              type="password"
              className="rpg-input w-full"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="rpg-btn rpg-btn-primary w-full mt-2 py-3 text-base">
            {isRegistering ? "Register Chronicle" : "Enter Emporium"}
          </button>
        </form>

        <div className="c-wrap mt-6 text-center text-sm text-slate-400 border-t border-white/5 pt-5">
          {isRegistering ? (
            <span>
              Already signed the scroll?{" "}
              <button
                onClick={() => { setIsRegistering(false); setError(''); }}
                className="btn btn-primary text-amber-400 hover:text-amber-300 hover:underline bg-transparent border-none cursor-pointer"
              >
                Log In Here
              </button>
            </span>
          ) : (
            <span>
              First time at the guild?{" "}
              <button
                onClick={() => { setIsRegistering(true); setError(''); }}
                className="btn btn-primary text-amber-400 hover:text-amber-300 hover:underline bg-transparent border-none cursor-pointer"
              >
                Create Account
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
