interface ImageViewerProps {
  image: string;
  title: string;
}

function ImageViewer({
  image,
  title,
}: ImageViewerProps) {
  return (
    <div className="space-y-6">

      <img
        src={image}
        alt={title}
        className="w-full rounded-2xl shadow-lg"
      />

    </div>
  );
}

export default ImageViewer;