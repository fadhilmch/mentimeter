// Local demo mode: in-memory MongoDB + seeded demo data. Nothing touches disk.
// Usage: npm run dev:memory   (server on :3000, serves ../client/dist when built)
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { startServer } from '../src/server.js';
import { User } from '../src/models/user.js';
import { Presentation } from '../src/models/presentation.js';

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri('livepoll-demo');
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

const { port } = await startServer({ mongoUri: process.env.MONGODB_URI });

const user = await User.create({
  name: 'Demo Presenter',
  username: 'demo',
  passwordHash: await bcrypt.hash('demo1234', 10),
});

const vote = (n) => Array.from({ length: n }, (_, i) => `seed-voter-${i}`);
await Presentation.create({
  owner: user._id,
  title: 'All-hands kickoff',
  location: 'Stockholm office',
  accessCode: '123456',
  theme: 'iris',
  currentSlide: 0,
  slides: [
    {
      questionType: 'multiple-choice',
      question: 'What should we focus on next quarter?',
      options: [
        { text: 'Product quality', votes: vote(12) },
        { text: 'New features', votes: vote(8) },
        { text: 'Performance', votes: vote(5) },
        { text: 'Hiring', votes: vote(3) },
      ],
      responses: [],
    },
    {
      questionType: 'open-ended',
      question: 'One thing we should start doing?',
      options: [],
      responses: [
        { text: 'Weekly demo hour', upvotes: vote(9), authorId: 'seed-a', createdAt: new Date() },
        { text: 'Write shorter PRs', upvotes: vote(6), authorId: 'seed-b', createdAt: new Date() },
        { text: 'Rotate meeting facilitation', upvotes: vote(4), authorId: 'seed-c', createdAt: new Date() },
        { text: 'Pair on tricky bugs', upvotes: vote(2), authorId: 'seed-d', createdAt: new Date() },
      ],
    },
  ],
});

console.log(`\nDemo ready on http://localhost:${port}`);
console.log('  Audience join code : 123456');
console.log('  Presenter login    : demo / demo1234\n');
