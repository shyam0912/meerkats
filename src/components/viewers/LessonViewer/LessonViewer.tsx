import ImageViewer from "../ImageViewer/ImageViewer";


interface Lesson {
  title: string;
  description: string;
  image: string;
  notes: string[];
}

interface Props {
  lesson: Lesson;
  selectedShelf: string;
  onBack: () => void;
}

function LessonViewer({
  lesson,
  selectedShelf,
  onBack,
}: Props) {
  return (
    <div className="space-y-6">

      <button
        onClick={onBack}
        className="px-4 py-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
      >
        ← Back to {selectedShelf}
      </button>

      <h1 className="text-4xl font-bold">
        {lesson.title}
      </h1>

      <ImageViewer
        image={lesson.image}
        title={lesson.title}
      />

      <p className="text-lg text-slate-700">
        {lesson.description}
      </p>

      <div>

        <h2 className="text-2xl font-bold mb-4">
          Key Points
        </h2>

        <ul className="list-disc ml-6 space-y-2">

          {lesson.notes.map((note) => (
            <li key={note}>
              {note}
            </li>
          ))}

        </ul>

      </div>

    </div>
  );
}

export default LessonViewer;