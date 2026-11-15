/*
 * Quiz Recall for StudyDock.
 *
 * Loads the current user's own Canvas submission history and fills the best
 * known answer when a question is hovered. Free and local: no account, no
 * backend, and no usage limit. Only runs on Canvas quiz "take" pages.
 */
(() => {
  if (window.__studyDockQuizLoader) {
    return;
  }
  window.__studyDockQuizLoader = true;

  const route = window.location.pathname.match(/\/courses\/(\d+)\/quizzes\/(\d+)\/take(?:\/|$)/);
  if (!route) {
    return;
  }

  const courseID = route[1];
  const quizID = route[2];

  const normalizeUrl = (value) => {
    if (!value) return '';
    try {
      const raw = /^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
      const parsed = new URL(raw);
      return `${parsed.protocol}//${parsed.hostname.replace(/^www\./, '')}`;
    }
    catch (e) {
      return '';
    }
  };

  const isBlocked = (blockedUrls) => {
    if ((blockedUrls || []).some((entry) => String(entry).trim() === '*')) return true;
    const current = normalizeUrl(window.location.href);
    if (!current) return false;
    return (blockedUrls || []).some((entry) => {
      const blocked = normalizeUrl(entry);
      return blocked && current.startsWith(blocked);
    });
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForQuestions = async (timeout = 12000) => {
    const started = Date.now();
    while (document.getElementsByClassName('question').length === 0) {
      if (Date.now() - started > timeout) return false;
      await delay(250);
    }
    return true;
  };

  const getJSON = async (url) => {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`Canvas API ${response.status} for ${url}`);
    }
    return response.json();
  };

  function getPointElements() {
    const pointHolders = document.getElementsByClassName('question_points_holder');
    const cleanPointHolders = [];

    for (const pointHolder of pointHolders) {
      if (!pointHolder.parentElement) continue;
      const classList = pointHolder.parentElement.classList;
      for (let i = 0; i < classList.length; i++) {
        if (classList[i] === 'header') {
          cleanPointHolders.push(pointHolder);
          break;
        }
      }
    }

    return cleanPointHolders;
  }

  function isIncorrectChoice(el) {
    const next = el.parentElement && el.parentElement.nextElementSibling;
    return !!next && String(next.className || '').includes('incorrect-answer');
  }

  function getQuestionIDs() {
    const questionIDs = [];
    const questionTextEls = document.getElementsByClassName('original_question_text');
    for (const el of questionTextEls) {
      const next = el.nextElementSibling;
      if (!next || !next.id) continue;
      questionIDs.push(next.id.split('_')[1]);
    }
    return questionIDs;
  }

  const QuestionTypes = {
    MULTIPLE_CHOICE: 'multiple_choice_question',
    TRUE_FALSE: 'true_false_question',
    FILL_IN_BLANK: 'short_answer_question',
    FILL_IN_M_BLANK: 'fill_in_multiple_blanks_question',
    MULTIPLE_ANSWER: 'multiple_answers_question',
    MULTIPLE_DROPDOWN: 'multiple_dropdowns_question',
    MATCHING: 'matching_question',
    NUMERICAL_ANSWER: 'numerical_question',
    FORMULA_QUESTION: 'calculated_question',
    ESSAY_QUESTION: 'essay_question'
  };

  async function getQuizSubmissions(baseURL) {
    const quizURL = `${baseURL}api/v1/courses/${courseID}/quizzes/${quizID}/`;
    const submissionsURL = `${quizURL}submissions`;

    const [quiz, submissions] = await Promise.all([
      getJSON(quizURL),
      getJSON(submissionsURL)
    ]);

    const quizSubmissions = Array.isArray(submissions.quiz_submissions) ? submissions.quiz_submissions : [];
    if (!quizSubmissions.length) {
      return [];
    }

    const assignmentID = quiz.assignment_id;
    const userID = quizSubmissions[quizSubmissions.length - 1].user_id;

    if (!assignmentID) {
      throw new Error('Canvas did not return an assignment id for this quiz.');
    }
    if (!userID) {
      throw new Error('Canvas did not return a user id for this quiz.');
    }

    const historyURL = `${baseURL}api/v1/courses/${courseID}/assignments/${assignmentID}/submissions/${userID}?include[]=submission_history`;
    const history = await getJSON(historyURL);
    return Array.isArray(history.submission_history) ? history.submission_history : [];
  }

  function restructureSubmission(submission) {
    if (!submission || !Array.isArray(submission.submission_data)) {
      return null;
    }

    const restructured = {};
    for (const question of submission.submission_data) {
      if (question && question.question_id !== undefined) {
        restructured[question.question_id] = question;
      }
    }
    return restructured;
  }

  function getCorrectAnswers(submissions) {
    const parsedSubmissions = {};

    for (const submission of submissions) {
      const restructured = restructureSubmission(submission);
      if (!restructured) continue;

      for (const questionID in restructured) {
        const question = restructured[questionID];

        if (!(questionID in parsedSubmissions)) {
          parsedSubmissions[questionID] = {
            attemptedAnswers: [],
            bestAttempt: question,
            latestAttempt: question
          };
        }

        if (parsedSubmissions[questionID].bestAttempt.correct === true) {
          continue;
        }

        if (question.correct === true) {
          parsedSubmissions[questionID].bestAttempt = question;
        }
        else if (parsedSubmissions[questionID].bestAttempt.points < question.points) {
          parsedSubmissions[questionID].bestAttempt = question;
        }
        else {
          parsedSubmissions[questionID].attemptedAnswers.push(question);
        }
      }
    }

    return Object.keys(parsedSubmissions).length ? parsedSubmissions : null;
  }

  class Displayer {
    displayAnswer(questionType, answer, questionID) {
      switch (questionType) {
        case QuestionTypes.ESSAY_QUESTION:
          this.displayEssay(answer, questionID);
          break;
        case QuestionTypes.MATCHING:
          this.displayMatching(answer, questionID);
          break;
        case QuestionTypes.MULTIPLE_ANSWER:
          this.displayMultipleAnswer(answer, questionID);
          break;
        case QuestionTypes.MULTIPLE_CHOICE:
        case QuestionTypes.TRUE_FALSE:
          this.displayMultipleChoice(answer, questionID);
          break;
        case QuestionTypes.FILL_IN_BLANK:
        case QuestionTypes.FORMULA_QUESTION:
        case QuestionTypes.NUMERICAL_ANSWER:
          this.displayFillInBlank(answer, questionID);
          break;
        case QuestionTypes.FILL_IN_M_BLANK:
          this.displayFillInMultipleBlank(answer, questionID);
          break;
        default:
          break;
      }
    }

    displayMatching(answer, questionID) {
      if (!answer) return;
      for (const answerProperty in answer) {
        if (!answerProperty.includes('answer_')) continue;
        const element = document.getElementById(`question_${questionID}_${answerProperty}`);
        if (element && !element.dataset.userModified && !element.dataset.studyDockFilled) {
          element.value = answer[answerProperty];
          element.dataset.studyDockFilled = 'true';
          element.addEventListener('input', () => {
            element.dataset.userModified = 'true';
          });
        }
      }
    }

    displayMultipleAnswer(answer, questionID) {
      if (!answer) return;
      for (const answerProperty in answer) {
        if (!answerProperty.includes('answer_')) continue;
        const element = document.getElementById(`question_${questionID}_${answerProperty}`);
        if (element && !element.dataset.userModified && !element.dataset.studyDockFilled) {
          element.checked = parseInt(answer[answerProperty], 10);
          element.dataset.studyDockFilled = 'true';
          element.addEventListener('change', () => {
            element.dataset.userModified = 'true';
          });
        }
      }
    }

    displayMultipleChoice(answer, questionID) {
      if (!answer) return;

      if (Array.isArray(answer.attemptedAnswers) && answer.attemptedAnswers.length) {
        for (const answerID of answer.attemptedAnswers) {
          const element = document.getElementById(`question_${questionID}_answer_${answerID}`);
          const next = element && element.parentElement && element.parentElement.nextElementSibling;
          if (next) {
            next.className += ' incorrect-answer';
          }
        }
      }

      if (answer.answer_id === undefined || answer.answer_id === null) {
        return;
      }

      const element = document.getElementById(`question_${questionID}_answer_${answer.answer_id}`);
      if (!element || element.dataset.userModified || element.dataset.studyDockFilled) {
        return;
      }

      if (!isIncorrectChoice(element)) {
        element.checked = true;
        element.dataset.studyDockFilled = 'true';
        element.addEventListener('change', () => {
          element.dataset.userModified = 'true';
        });
      }
    }

    displayFillInBlank(answer, questionID) {
      if (!answer) return;
      let element = null;
      const elements = document.getElementsByName(`question_${questionID}`);
      for (const candidate of elements) {
        if (candidate.tagName === 'INPUT' && !candidate.dataset.userModified && !candidate.dataset.studyDockFilled) {
          element = candidate;
          break;
        }
      }

      if (element) {
        element.value = answer.text;
        element.dataset.studyDockFilled = 'true';
        element.addEventListener('input', () => {
          element.dataset.userModified = 'true';
        });
      }
    }

    displayEssay(answer, questionID) {
      if (!answer) return;
      setTimeout(() => {
        try {
          const topParent = document.getElementById(`question_${questionID}_question_text`);
          const parent = topParent.nextElementSibling.firstElementChild.children[2]
            .firstElementChild.firstElementChild.children[1].firstElementChild;
          const iframe = parent.contentDocument ? parent.contentDocument : parent.contentWindow.document;
          const editor = iframe.getElementById('tinymce');
          if (editor && !editor.dataset.userModified && !editor.dataset.studyDockFilled) {
            editor.innerHTML = answer.text;
            editor.dataset.studyDockFilled = 'true';
            editor.addEventListener('input', () => {
              editor.dataset.userModified = 'true';
            });
          }
        }
        catch (e) {
          const topParent = document.getElementById(`question_${questionID}_question_text`);
          if (topParent) {
            const paragraph = document.createElement('p');
            paragraph.textContent = answer.text;
            topParent.appendChild(paragraph);
          }
        }
      }, 500);
    }

    displayFillInMultipleBlank(answer, questionID) {
      if (!answer) return;
      const topParent = document.getElementById(`question_${questionID}_question_text`);
      if (!topParent) return;
      const inputs = topParent.querySelectorAll('input');
      const answerKeys = Object.keys(answer).filter((key) => key.includes('answer_for'));

      if (answerKeys.length !== inputs.length) return;

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        if (!input.dataset.userModified && !input.dataset.studyDockFilled) {
          input.value = answer[answerKeys[i]];
          input.dataset.studyDockFilled = 'true';
          input.addEventListener('input', () => {
            input.dataset.userModified = 'true';
          });
        }
      }
    }
  }

  function display(answers) {
    const questions = document.getElementsByClassName('question');
    const questionTypes = document.getElementsByClassName('question_type');
    const displayer = new Displayer();
    const pointHolders = getPointElements();
    const questionIDs = getQuestionIDs();

    const autoFilledQuestions = {};

    for (let i = 0; i < questions.length; i++) {
      const questionTypeEl = questionTypes[i];
      const questionID = questionIDs[i];
      if (!questionTypeEl || !questionID) continue;

      const questionType = questionTypeEl.innerText;
      const questionElement = questions[i];
      const pointHolder = pointHolders[i];
      if (!questionElement || !pointHolder) continue;

      const originalPointText = pointHolder.innerText;

      if (answers[questionID]) {
        const answer = answers[questionID].bestAttempt;
        answer.attemptedAnswers = [];
        for (const attemptedAnswer of answers[questionID].attemptedAnswers || []) {
          if (attemptedAnswer.text) {
            answer.attemptedAnswers.push(attemptedAnswer.text);
          }
        }

        autoFilledQuestions[questionID] = false;

        questionElement.addEventListener('mouseenter', () => {
          if (!autoFilledQuestions[questionID]) {
            displayer.displayAnswer(questionType, answer, questionID);
            autoFilledQuestions[questionID] = true;
          }

          const earnedPoints = Math.round(answer.points * 100) / 100;
          pointHolder.classList.add(earnedPoints === parseFloat(originalPointText) ? 'correct-answer' : 'incorrect-answer');
          pointHolder.innerText = `${earnedPoints} out of ${originalPointText}`;
        });

        questionElement.addEventListener('mouseleave', () => {
          pointHolder.innerText = originalPointText;
          pointHolder.classList.remove('correct-answer', 'incorrect-answer');
        });
      }
      else {
        questionElement.addEventListener('mouseenter', () => {
          pointHolder.innerText = `(New Question) ${originalPointText}`;
        });

        questionElement.addEventListener('mouseleave', () => {
          pointHolder.innerText = originalPointText;
        });
      }
    }
  }

  async function loadQuiz() {
    const baseURL = new URL('/', window.location.href).href;
    const submissions = await getQuizSubmissions(baseURL);
    if (!submissions.length) {
      console.info('[StudyDock] Quiz Recall: no prior submissions found.');
      return;
    }

    const correctAnswers = getCorrectAnswers(submissions);
    if (!correctAnswers) {
      console.info('[StudyDock] Quiz Recall: no reusable answers found.');
      return;
    }

    if (!await waitForQuestions()) {
      console.info('[StudyDock] Quiz Recall: quiz questions did not appear.');
      return;
    }

    display(correctAnswers);
  }

  chrome.storage.local.get({
    enabled: true,
    quizLoaderEnabled: null,
    saveCorrectAnswers: null,
    blockedUrls: []
  }, (prefs) => {
    const legacyEnabled = prefs.saveCorrectAnswers !== false;
    const quizEnabled = prefs.quizLoaderEnabled === null ? legacyEnabled : prefs.quizLoaderEnabled !== false;

    if (prefs.enabled === false || !quizEnabled || isBlocked(prefs.blockedUrls)) {
      return;
    }

    loadQuiz().catch((error) => {
      console.info('[StudyDock] Quiz Recall unavailable:', error.message);
    });
  });
})();
