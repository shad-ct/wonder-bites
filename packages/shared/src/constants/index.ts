/** Workflow slug identifiers — stable across the entire system */
export const WORKFLOW_SLUGS = [
  'weekly-coding-challenge',
  'facts-and-quotes',
  'concept-of-the-day',
  'mind-signal',
  'daily-random-project-ideas',
  'science-signal',
  'math-practice',
] as const;

export type WorkflowSlug = (typeof WORKFLOW_SLUGS)[number];

/** Reading list item statuses */
export const READING_STATUSES = ['saved', 'reading', 'completed'] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

/** Workflow run statuses */
export const RUN_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'skipped'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Actor types for audit logs */
export const ACTOR_TYPES = ['user', 'mcp', 'system'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** Trigger sources for workflow runs */
export const TRIGGER_SOURCES = ['scheduled', 'manual', 'mcp'] as const;
export type TriggerSource = (typeof TRIGGER_SOURCES)[number];

/** Content format types */
export const CONTENT_FORMATS = ['markdown', 'html', 'plain'] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

/** Concept of the Day domains */
export const CONCEPT_DOMAINS = ['Mathematics', 'Physics', 'Computer Science', 'Biology'] as const;
export type ConceptDomain = (typeof CONCEPT_DOMAINS)[number];

/** Mind Signal categories */
export const MIND_SIGNAL_CATEGORIES = ['Philosophy', 'Psychology', 'Thought Experiment'] as const;
export type MindSignalCategory = (typeof MIND_SIGNAL_CATEGORIES)[number];

/** Project Ideas — allowed areas */
export const PROJECT_AREAS = [
  'Software & Digital',
  'Hardware & Electronics',
  'Textiles & Fiber Arts',
  'Paper & Print',
  'Chemistry & Kitchen',
  'Gardening & Outdoor',
  'Music & Performance',
  'Games & Puzzles',
  'Miscellaneous',
] as const;
export type ProjectArea = (typeof PROJECT_AREAS)[number];

/** Project Ideas — excluded areas */
export const EXCLUDED_PROJECT_AREAS = [
  'Woodworking',
  'Metalworking',
  'Acrylic/Resin/Glass',
  'Ceramics/Sculpture',
  'Model Kits',
] as const;

/** Math Practice — all 32 modules */
export const MATH_MODULES = [
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
] as const;

/** Default timezone */
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** Pagination defaults */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/** MCP error codes */
export const MCP_ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  AUTH_FAILED: 'AUTH_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE: 'DUPLICATE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFLICT: 'CONFLICT',
} as const;

/** Workflow seed data — names and descriptions */
export const WORKFLOW_DEFINITIONS: Record<WorkflowSlug, {
  name: string;
  description: string;
  defaultSchedule: string;
}> = {
  'weekly-coding-challenge': {
    name: 'Weekly Coding Challenge',
    description: 'Publishes one programming challenge each week, rotating algorithmic patterns at beginner to early-intermediate difficulty.',
    defaultSchedule: '0 9 * * 1', // Monday 9 AM
  },
  'facts-and-quotes': {
    name: 'Facts & Quotes',
    description: 'Daily collection of five surprising facts from distinct subject areas and five diverse, verified quotations with introspective questions.',
    defaultSchedule: '0 7 * * *', // Daily 7 AM
  },
  'concept-of-the-day': {
    name: 'Concept of the Day',
    description: 'Explains one concept clearly each day, rotating between Mathematics, Physics, Computer Science, and Biology.',
    defaultSchedule: '0 8 * * *', // Daily 8 AM
  },
  'mind-signal': {
    name: 'Mind Signal',
    description: 'One concise philosophical or psychological idea each day, rotating between philosophy, psychology, and thought experiments.',
    defaultSchedule: '30 8 * * *', // Daily 8:30 AM
  },
  'daily-random-project-ideas': {
    name: 'Daily Random Project Ideas',
    description: 'Five documented, feasible projects per day from diverse areas with source URLs and variant suggestions. Weekly roundup on Sundays.',
    defaultSchedule: '0 9 * * *', // Daily 9 AM
  },
  'science-signal': {
    name: 'Science Signal',
    description: 'Summarizes recent science and astronomy news from the previous 24–48 hours with accessible analogies and source citations.',
    defaultSchedule: '0 10 * * *', // Daily 10 AM
  },
  'math-practice': {
    name: 'Math Practice',
    description: 'Progressively teaches a 32-module Applied Mathematics syllabus with worked examples, practice problems, and answer keys.',
    defaultSchedule: '0 11 * * *', // Daily 11 AM
  },
};
