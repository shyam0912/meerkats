export interface LessonContent {
  title: string;
  description: string;
  image: string;
  video?: string;
  notes: string[];
}

export const contentViewer: Record<string, LessonContent> = {
  "Human Digestive System": {
    title: "Human Digestive System",

    description:
      "The digestive system breaks down food into nutrients that the body can absorb and use for energy, growth, and repair.",

    image:
      "https://placehold.co/800x500?text=Human+Digestive+System",

    notes: [
      "Food enters through the mouth.",
      "The stomach breaks down food using acids.",
      "Nutrients are absorbed in the small intestine.",
      "Waste exits through the large intestine.",
    ],
  },

  "Plant Cell": {
    title: "Plant Cell",

    description:
      "Plant cells are the basic building blocks of plants and contain chloroplasts for photosynthesis.",

    image:
      "https://placehold.co/800x500?text=Plant+Cell",

    notes: [
      "Contains a cell wall.",
      "Contains chloroplasts.",
      "Stores water in vacuoles.",
      "Performs photosynthesis.",
    ],
  },

  "Animal Cell": {
    title: "Animal Cell",

    description:
      "Animal cells are eukaryotic cells that form tissues and organs in animals.",

    image:
      "https://placehold.co/800x500?text=Animal+Cell",

    notes: [
      "No cell wall.",
      "Contains nucleus.",
      "Contains mitochondria.",
      "Forms tissues and organs.",
    ],
  },
};