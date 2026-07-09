import express from 'express';

const router = express.Router();

// Mock AI Quiz Generator
router.post('/generate', async (req, res) => {
  const { topic } = req.body;
  
  if (!topic) {
    return res.status(400).json({ success: false, error: 'Topic is required' });
  }

  try {
    // Artificial delay to simulate AI generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Hardcoded mock questions for demonstration
    const mockQuestions = [
      {
        text: `What is the most famous event related to ${topic}?`,
        options: ["The Great Battle", "The Discovery", "The Invention", "The Accord"],
        correctOption: 0
      },
      {
        text: `Who is a key figure associated with ${topic}?`,
        options: ["Albert Einstein", "Marie Curie", "John Doe", "Jane Smith"],
        correctOption: 2
      },
      {
        text: `In what year did ${topic} significantly impact the world?`,
        options: ["1920", "1999", "2010", "2024"],
        correctOption: 1
      },
      {
        text: `Which of these is a common misconception about ${topic}?`,
        options: ["It is dangerous", "It is expensive", "It is illegal", "It is fictional"],
        correctOption: 3
      },
      {
        text: `What is the primary benefit of ${topic}?`,
        options: ["Efficiency", "Entertainment", "Education", "Health"],
        correctOption: 0
      }
    ];

    res.json({ success: true, questions: mockQuestions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to generate quiz' });
  }
});

export default router;
