import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const WORKFLOW_DEFINITIONS = [
  {
    slug: 'weekly-coding-challenge',
    name: 'Weekly Coding Challenge',
    description: 'Publishes one programming challenge each week, rotating algorithmic patterns at beginner to early-intermediate difficulty.',
    scheduleExpression: '0 9 * * 1',
    configuration: {
      difficulty: 'beginner-to-intermediate',
      recentPatternsWindow: 8,
      feedbackEnabled: true,
    },
  },
  {
    slug: 'facts-and-quotes',
    name: 'Facts & Quotes',
    description: 'Daily collection of five surprising facts from distinct subject areas and five diverse, verified quotations with introspective questions.',
    scheduleExpression: '0 7 * * *',
    configuration: {
      factsCount: 5,
      quotesCount: 5,
      questionsCount: 2,
    },
  },
  {
    slug: 'concept-of-the-day',
    name: 'Concept of the Day',
    description: 'Explains one concept clearly each day, rotating between Mathematics, Physics, Computer Science, and Biology.',
    scheduleExpression: '0 8 * * *',
    configuration: {
      domains: ['Mathematics', 'Physics', 'Computer Science', 'Biology'],
      maxWords: 250,
    },
  },
  {
    slug: 'mind-signal',
    name: 'Mind Signal',
    description: 'One concise philosophical or psychological idea each day, rotating between philosophy, psychology, and thought experiments.',
    scheduleExpression: '30 8 * * *',
    configuration: {
      categories: ['Philosophy', 'Psychology', 'Thought Experiment'],
      maxWords: 250,
    },
  },
  {
    slug: 'daily-random-project-ideas',
    name: 'Daily Random Project Ideas',
    description: 'Five documented, feasible projects per day from diverse areas with source URLs and variant suggestions. Weekly roundup on Sundays.',
    scheduleExpression: '0 9 * * *',
    configuration: {
      projectsPerDay: 5,
      tweaksPerProject: 3,
      sundayRoundup: true,
      excludedAreas: ['Woodworking', 'Metalworking', 'Acrylic/Resin/Glass', 'Ceramics/Sculpture', 'Model Kits'],
    },
  },
  {
    slug: 'science-signal',
    name: 'Science Signal',
    description: 'Summarizes recent science and astronomy news from the previous 24–48 hours with accessible analogies and source citations.',
    scheduleExpression: '0 10 * * *',
    configuration: {
      storiesCount: 3,
      lookbackHours: 48,
    },
  },
  {
    slug: 'math-practice',
    name: 'Math Practice',
    description: 'Progressively teaches a 32-module Applied Mathematics syllabus with worked examples, practice problems, and answer keys.',
    scheduleExpression: '0 11 * * *',
    configuration: {
      totalModules: 32,
      currentModule: 1,
      completedModules: [],
      workedExamples: 5,
      practiceProblems: 5,
      syllabus: [
        { number: 1, name: 'Functions as Models', domains: ['Algebra'] },
        { number: 2, name: 'Vectors as Data', domains: ['Linear Algebra'] },
        { number: 3, name: 'Trigonometry & Orientation', domains: ['Algebra', 'Geometry'] },
        { number: 4, name: "Complex Numbers & Euler's Formula", domains: ['Algebra'] },
        { number: 5, name: 'Logic and Boolean Reasoning', domains: ['Discrete Mathematics'] },
        { number: 6, name: 'Rates of Change', domains: ['Calculus'] },
        { number: 7, name: 'Describing Uncertainty — Data & Distributions', domains: ['Statistics'] },
        { number: 8, name: 'Solving Equations & Root-Finding', domains: ['Algebra'] },
        { number: 9, name: 'Matrices as Transformations', domains: ['Linear Algebra'] },
        { number: 10, name: 'Sets, Counting & Combinatorics', domains: ['Discrete Mathematics'] },
        { number: 11, name: 'Accumulation and Integration', domains: ['Calculus'] },
        { number: 12, name: 'Taylor Series & Polynomial Approximation', domains: ['Calculus'] },
        { number: 13, name: 'Probability as a Formal System', domains: ['Statistics'] },
        { number: 14, name: 'Systems of Linear Equations', domains: ['Linear Algebra'] },
        { number: 15, name: 'Graphs as Relationship Models', domains: ['Discrete Mathematics'] },
        { number: 16, name: 'Optimization Basics — Finding Minima & Maxima', domains: ['Algebra', 'Calculus'] },
        { number: 17, name: 'Random Variables & Distributions', domains: ['Statistics'] },
        { number: 18, name: 'Multivariable Calculus & Gradients', domains: ['Calculus', 'Linear Algebra'] },
        { number: 19, name: 'Eigenvalues & Eigenvectors', domains: ['Linear Algebra'] },
        { number: 20, name: 'Graph Algorithms, Complexity & Big-O', domains: ['Discrete Mathematics'] },
        { number: 21, name: 'Chain Rule, Backpropagation & Intro to Differential Equations', domains: ['Calculus', 'Linear Algebra'] },
        { number: 22, name: 'Statistical Inference & Hypothesis Testing', domains: ['Statistics'] },
        { number: 23, name: 'Constrained Optimization & Convexity', domains: ['Algebra', 'Calculus'] },
        { number: 24, name: 'Matrix Decompositions — SVD & Low-Rank Structure', domains: ['Linear Algebra'] },
        { number: 25, name: 'Number Theory & Cryptography', domains: ['Discrete Mathematics'] },
        { number: 26, name: 'Dimensionality Reduction — PCA', domains: ['Linear Algebra', 'Statistics'] },
        { number: 27, name: 'Bayesian Inference & Updating Beliefs', domains: ['Statistics'] },
        { number: 28, name: 'Randomized Algorithms & Probabilistic Analysis', domains: ['Discrete Mathematics', 'Statistics'] },
        { number: 29, name: 'Markov Chains & Stochastic Processes', domains: ['Linear Algebra', 'Statistics', 'Discrete Mathematics'] },
        { number: 30, name: 'Differential Equations & Dynamical Systems', domains: ['Calculus'] },
        { number: 31, name: 'Numerical Methods — Floating-Point & Fixed-Point Arithmetic', domains: ['Applied/Computational Mathematics'] },
        { number: 32, name: 'Capstone — The Optimization Landscape: Why Deep Learning Training Works', domains: ['Cross-domain'] },
      ],
    },
  },
];

async function main() {
  console.log('🌱 Seeding database...\n');

  // Create or update the default user
  const username = process.env.INITIAL_USERNAME || 'admin';
  const password = process.env.INITIAL_USER_PASSWORD || 'changeme123';

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash,
      timezone: 'Asia/Kolkata',
      preferences: {},
    },
  });

  console.log(`✅ User created/verified: ${user.username} (${user.id})`);

  // Seed workflows
  for (const def of WORKFLOW_DEFINITIONS) {
    const workflow = await prisma.workflow.upsert({
      where: { slug: def.slug },
      update: {
        name: def.name,
        description: def.description,
      },
      create: {
        slug: def.slug,
        name: def.name,
        description: def.description,
        scheduleExpression: def.scheduleExpression,
        timezone: 'Asia/Kolkata',
        configuration: def.configuration as object,
        enabled: true,
      },
    });

    console.log(`✅ Workflow seeded: ${workflow.name} (${workflow.slug})`);
  }

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
