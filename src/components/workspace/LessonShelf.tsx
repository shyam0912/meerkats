interface LessonShelfProps {
  shelfItems: string[];
  selectedShelf: string;
  onShelfSelect: (item: string) => void;
}

function LessonShelf({
  shelfItems,
  selectedShelf,
  onShelfSelect,
}: LessonShelfProps) {
  return (
    <div className="h-28 bg-white shadow-inner flex items-center justify-center gap-6">

      {shelfItems.map((item) => (
        <button
          key={item}
          onClick={() => onShelfSelect(item)}
          className={`px-6 py-3 rounded-xl transition ${
            selectedShelf === item
              ? "bg-blue-600 text-white"
              : "bg-slate-100 hover:bg-slate-200"
          }`}
        >
          {item}
        </button>
      ))}

    </div>
  );
}

export default LessonShelf;