import LessonViewer from "../viewers/LessonViewer/LessonViewer";
import DrawingCanvas from "../workspace/DrawingCanvas";
import { contentViewer } from "../../data/contentViewer";
import BackgroundLayer from "../layers/BackgroundLayer";
import LessonLayer from "../layers/LessonLayer";
import AnnotationLayer from "../layers/AnnotationLayer";
import FloatingLayer from "../layers/FloatingLayer";

interface CanvasRendererProps {
  selectedShelf: string;
  selectedLesson: string;
  currentContent: string[];
  onLessonSelect: (lesson: string) => void;
  onBack: () => void;
}

function CanvasRenderer({
  selectedShelf,
  selectedLesson,
  currentContent,
  onLessonSelect,
  onBack,
}: CanvasRendererProps) {
  const lesson = selectedLesson
    ? contentViewer[selectedLesson]
    : null;

  return (
    <div className="w-full h-full bg-white rounded-3xl shadow-lg p-8 overflow-hidden">

      {!selectedShelf && (
        <div className="w-full h-full">
          <DrawingCanvas />
        </div>
      )}

      {selectedShelf &&
        !selectedLesson && (
          <>
            <h2 className="text-3xl font-bold mb-8">
              {selectedShelf}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {currentContent.map((content) => (
                <button
                  key={content}
                  onClick={() => onLessonSelect(content)}
                  className="h-24 bg-slate-100 rounded-2xl text-xl font-semibold hover:bg-slate-200 transition"
                >
                  {content}
                </button>
              ))}
            </div>
          </>
        )}

      {lesson && (
        <LessonViewer
          lesson={lesson}
          selectedShelf={selectedShelf}
          onBack={onBack}
        />
      )}

    </div>
  );
}

export default CanvasRenderer;