export const SUBJECT_SEED = [
  {
    code: 'CS201',
    name: 'Data Structures and Algorithms',
    category: 'Algorithms',
    description: 'Arrays, linked lists, trees, graphs, sorting, searching and complexity analysis.',
  },
  {
    code: 'CS202',
    name: 'Database Management Systems',
    category: 'Database',
    description:
      'Relational model, SQL, normalisation, transactions, indexing and query processing.',
  },
  {
    code: 'CS203',
    name: 'Operating Systems',
    category: 'Systems',
    description: 'Processes, threads, scheduling, memory management, file systems and concurrency.',
  },
  {
    code: 'CS204',
    name: 'Computer Networks',
    category: 'Networking',
    description:
      'OSI and TCP/IP models, routing, transport protocols, DNS, HTTP and network security.',
  },
  {
    code: 'CS205',
    name: 'Object-Oriented Programming',
    category: 'Programming',
    description: 'Classes, inheritance, polymorphism, encapsulation, design patterns and SOLID.',
  },
  {
    code: 'CS206',
    name: 'Software Engineering',
    category: 'Software Engineering',
    description: 'SDLC, requirements, design, testing, agile methods and project management.',
  },
  {
    code: 'CS207',
    name: 'Theory of Computation',
    category: 'Theory',
    description:
      'Automata, regular languages, context-free grammars, Turing machines, decidability.',
  },
  {
    code: 'CS208',
    name: 'Computer Organization and Architecture',
    category: 'Systems',
    description: 'Instruction sets, pipelining, memory hierarchy, caches and I/O.',
  },
  {
    code: 'CS301',
    name: 'Machine Learning',
    category: 'Artificial Intelligence',
    description: 'Supervised and unsupervised learning, model evaluation, neural networks.',
  },
  {
    code: 'CS302',
    name: 'Web Development',
    category: 'Programming',
    description:
      'HTML, CSS, JavaScript, HTTP, REST APIs, front-end frameworks and back-end services.',
  },
  {
    code: 'CS303',
    name: 'Compiler Design',
    category: 'Theory',
    description:
      'Lexical analysis, parsing, semantic analysis, intermediate code and optimisation.',
  },
  {
    code: 'MA101',
    name: 'Discrete Mathematics',
    category: 'Mathematics',
    description: 'Logic, sets, relations, combinatorics, graph theory and proof techniques.',
  },
  {
    code: 'MA102',
    name: 'Engineering Mathematics',
    category: 'Mathematics',
    description: 'Calculus, linear algebra, differential equations, probability and statistics.',
  },
  {
    code: 'EC101',
    name: 'Digital Logic Design',
    category: 'Electronics',
    description: 'Boolean algebra, logic gates, combinational and sequential circuits.',
  },
] as const;

export const DEMO_QUESTIONS = [
  {
    subjectCode: 'CS202',
    title: 'How does normalization work in DBMS?',
    description:
      'I understand 1NF, but I get confused between 2NF and 3NF. Can someone explain partial and transitive dependencies with an example table?',
  },
  {
    subjectCode: 'CS201',
    title: 'Why is quicksort O(n log n) on average but O(n²) in the worst case?',
    description:
      'Our lecture showed the recurrence but I do not see intuitively why a bad pivot makes it quadratic. What input triggers the worst case?',
  },
  {
    subjectCode: 'CS203',
    title: 'Difference between a mutex and a semaphore?',
    description:
      'Both seem to protect critical sections. When would I choose a counting semaphore over a mutex in practice?',
  },
  {
    subjectCode: 'CS204',
    title: 'Why does TCP need a three-way handshake instead of two?',
    description:
      'Could the connection be established reliably with only SYN and SYN-ACK? What goes wrong with old duplicate packets?',
  },
  {
    subjectCode: 'MA101',
    title: 'How do I prove a statement using strong induction?',
    description:
      'I can do ordinary induction proofs but I am unsure when strong induction is required and how the inductive hypothesis changes.',
  },
] as const;
