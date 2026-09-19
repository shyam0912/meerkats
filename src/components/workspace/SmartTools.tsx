interface Props {
  tools: string[];
}

function SmartTools({ tools }: Props) {
  return (
    <div className="w-72 bg-white shadow-lg p-4">

      <h2 className="text-xl font-bold mb-4">
        Smart Tools
      </h2>

      <div className="space-y-4">

        {tools.map((tool) => (
          <button
            key={tool}
            disabled title="Not available in this milestone"
            className="w-full h-16 bg-slate-100 rounded-xl opacity-40 cursor-not-allowed"
          >
            {tool}
          </button>
        ))}

      </div>

    </div>
  );
}

export default SmartTools;
