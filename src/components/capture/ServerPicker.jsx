// Shown only at the start of a rally, before the first shot. A single tap
// picks the server and drops the user straight into the serve palette.

export default function ServerPicker({ onPick }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full py-10">
      <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Who's serving?</div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm px-4">
        <button
          onClick={() => onPick("S")}
          className="py-6 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-display font-bold text-lg active:scale-95"
        >
          Son
        </button>
        <button
          onClick={() => onPick("O")}
          className="py-6 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 font-display font-bold text-lg active:scale-95"
        >
          Opponent
        </button>
      </div>
    </div>
  );
}
