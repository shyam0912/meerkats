import { useNavigate } from "react-router-dom";
import { subjects, type Subject } from "../../data/subject";
import { useClassroom } from "../../store/useClassroom";

function SubjectSelection() {
  const navigate = useNavigate();
  const { setSelectedSubject } = useClassroom();

  return (
    <div className="min-h-screen bg-slate-100 p-10">

      {/* Back Button */}
      <div className="max-w-6xl mx-auto mb-8">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-white rounded-2xl shadow-lg text-lg font-semibold hover:scale-105 transition"
        >
          ← Back
        </button>
      </div>

      {/* Title */}
      <h1 className="text-5xl font-bold text-center mb-12">
        Select Subject
      </h1>

      {/* Subject Grid */}
      <div className="grid grid-cols-3 gap-8 max-w-6xl mx-auto">

        {subjects.map((subject: Subject) => (
          <button
            key={subject.name}
            onClick={() => {
              setSelectedSubject(subject.name);
              navigate("/workspace");
            }}
            className="h-44 bg-white rounded-3xl shadow-lg hover:scale-105 transition"
          >
            <div className="text-5xl mb-4">
              {subject.icon}
            </div>

            <div className="text-2xl font-semibold">
              {subject.name}
            </div>
          </button>
        ))}

      </div>

    </div>
  );
}

export default SubjectSelection;