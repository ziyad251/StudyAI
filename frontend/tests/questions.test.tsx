import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QuestionCard } from '@/components/questions/question-card';
import { AskQuestionPage } from '@/pages/student/ask-question-page';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { makeQuestion, makeUser, renderApp } from './utils';

vi.mock('@/lib/api', () => ({
  api: {
    auth: { me: vi.fn() },
    subjects: { list: vi.fn() },
    ai: { status: vi.fn(), classify: vi.fn(), checkPersonalInformation: vi.fn() },
    questions: { create: vi.fn() },
  },
}));

const mocked = vi.mocked(api, { deep: true });

const SUBJECTS = [
  {
    id: 's-dbms',
    name: 'Database Management Systems',
    code: 'CS202',
    category: 'Database',
    description: null,
    isActive: true,
  },
  {
    id: 's-os',
    name: 'Operating Systems',
    code: 'CS203',
    category: 'Systems',
    description: null,
    isActive: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocked.auth.me.mockResolvedValue(makeUser());
  mocked.subjects.list.mockResolvedValue(SUBJECTS);
  mocked.ai.status.mockResolvedValue({ available: true, model: 'gemini' });
  mocked.ai.checkPersonalInformation.mockResolvedValue({
    hasPersonalInformation: false,
    findings: [],
    aiChecked: true,
    disclaimer: 'Automated checks cannot guarantee detection.',
  });
});

describe('QuestionCard', () => {
  it('never shows author identity, only "Anonymous student"', () => {
    render(
      <MemoryRouter>
        <QuestionCard question={makeQuestion()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Anonymous student')).toBeInTheDocument();
    expect(screen.getByText('Teacher answered')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /normalization/i })).toHaveAttribute(
      'href',
      '/questions/q-1',
    );
  });

  it('tells the asker which questions are theirs', () => {
    render(
      <MemoryRouter>
        <QuestionCard question={makeQuestion({ isOwn: true })} />
      </MemoryRouter>,
    );
    expect(screen.getByText('You asked')).toBeInTheDocument();
  });
});

describe('Ask a question', () => {
  const setup = async () => {
    const user = userEvent.setup();
    renderApp(<AskQuestionPage />, {
      route: '/questions/ask',
      path: '/questions/ask',
      extraRoutes: [{ path: '/questions/:id', element: <p>Question page</p> }],
    });
    await user.type(
      await screen.findByLabelText('Title'),
      'What is the difference between 2NF and 3NF?',
    );
    await user.type(
      screen.getByLabelText('Details'),
      'I keep confusing partial and transitive dependencies.',
    );
    return user;
  };

  it('validates title and description length', async () => {
    const user = userEvent.setup();
    renderApp(<AskQuestionPage />, { route: '/a', path: '/a' });
    await user.type(await screen.findByLabelText('Title'), 'short');
    await user.click(screen.getByRole('button', { name: /post anonymously/i }));
    expect(await screen.findByText('Title must be at least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('Description must be at least 20 characters')).toBeInTheDocument();
    expect(mocked.questions.create).not.toHaveBeenCalled();
  });

  it('suggests a subject with AI and applies it', async () => {
    mocked.ai.classify.mockResolvedValue({
      subjectId: 's-dbms',
      subject: 'Database Management Systems',
      subjectCode: 'CS202',
      category: 'Normalization',
      confidence: 0.94,
    });
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /suggest subject/i }));
    expect(await screen.findByText(/94% confident/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /use this subject/i }));
    expect(screen.getByRole('combobox', { name: 'Subject' })).toHaveTextContent('CS202');
  });

  it('runs the privacy check and submits a clean question', async () => {
    mocked.questions.create.mockResolvedValue(makeQuestion({ id: 'new-q', isOwn: true }));
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /post anonymously/i }));

    expect(await screen.findByText('Question page')).toBeInTheDocument();
    expect(mocked.ai.checkPersonalInformation).toHaveBeenCalledWith(
      expect.stringContaining('2NF and 3NF'),
    );
    expect(mocked.questions.create).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: undefined, acknowledgePersonalInfo: false }),
    );
  });

  it('warns about personal information and lets the student edit instead of posting', async () => {
    mocked.ai.checkPersonalInformation.mockResolvedValue({
      hasPersonalInformation: true,
      findings: [
        {
          type: 'PHONE',
          excerpt: '98•••••10',
          message: 'Looks like a phone number.',
          source: 'PATTERN',
        },
      ],
      aiChecked: true,
      disclaimer: 'Automated checks cannot guarantee detection.',
    });
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /post anonymously/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Your question may contain personal information');
    expect(dialog).toHaveTextContent('Phone number');
    expect(dialog).toHaveTextContent('cannot guarantee');

    await user.click(screen.getByRole('button', { name: /edit my question/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocked.questions.create).not.toHaveBeenCalled();
  });

  it('posts with explicit acknowledgement when the student chooses "Post anyway"', async () => {
    mocked.ai.checkPersonalInformation.mockResolvedValue({
      hasPersonalInformation: true,
      findings: [
        {
          type: 'EMAIL',
          excerpt: 'me•••@x.co',
          message: 'Looks like an email address.',
          source: 'PATTERN',
        },
      ],
      aiChecked: false,
      disclaimer: 'd',
    });
    mocked.questions.create.mockResolvedValue(makeQuestion({ id: 'new-q' }));
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /post anonymously/i }));
    await user.click(await screen.findByRole('button', { name: /post anyway/i }));
    await waitFor(() =>
      expect(mocked.questions.create).toHaveBeenCalledWith(
        expect.objectContaining({ acknowledgePersonalInfo: true }),
      ),
    );
  });

  it('asks for a subject when the server cannot classify confidently', async () => {
    mocked.questions.create.mockRejectedValue(
      new ApiError(
        'We could not confidently determine the subject. Please choose one.',
        422,
        'SUBJECT_REQUIRED',
      ),
    );
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /post anonymously/i }));
    expect(await screen.findByText(/please choose one/i)).toBeInTheDocument();
  });

  it('falls back to manual subject selection when AI is unavailable', async () => {
    mocked.ai.status.mockResolvedValue({ available: false, model: null });
    renderApp(<AskQuestionPage />, { route: '/a', path: '/a' });
    expect(await screen.findByText(/AI suggestions are unavailable/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /suggest subject/i })).not.toBeInTheDocument();
  });
});
