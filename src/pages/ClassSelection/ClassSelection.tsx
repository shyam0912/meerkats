import { useNavigate } from "react-router-dom";
import { classes } from "../../data/classes";
import { useClassroom } from "../../store/useClassroom";

function ClassSelection() {
  const navigate = useNavigate();

  // ADD THIS
  const { setSelectedClass } = useClassroom();

  return (
    <div className="min-h-screen bg-slate-100 p-10">

      {/* Back Button */}
      <div className="max-w-7xl mx-auto mb-8">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-white rounded-2xl shadow-lg text-lg font-semibold hover:scale-105 transition"
        >
          ← Back
        </button>
      </div>

      {/* Page Title */}
      <h1 className="text-5xl font-bold text-center mb-12">
        Select Class
      </h1>

      {/* Class Grid */}
      <div className="grid grid-cols-5 gap-6 max-w-7xl mx-auto">

        {classes.map((item) => (
          <button
            key={item}
            onClick={() => {
              setSelectedClass(item);
              navigate("/subjects");
            }}
            className="h-36 rounded-3xl bg-white shadow-lg text-3xl font-bold hover:scale-105 transition"
          >
            {item}
          </button>
        ))}

      </div>

    </div>
  );
}

export default ClassSelection;