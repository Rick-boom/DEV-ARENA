import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { storage } from '@/utils/storage.js';

/**
 * Workspace layout. Panel sizes persist because a developer who drags
 * the editor wider expects it to stay that way on the next problem —
 * layout is a preference, not per-page state.
 */
export const ProblemTab = {
  DESCRIPTION: 'description',
  EDITORIAL: 'editorial',
  SUBMISSIONS: 'submissions',
} as const;
export type ProblemTab = (typeof ProblemTab)[keyof typeof ProblemTab];

export const ConsoleTab = {
  TESTCASES: 'testcases',
  OUTPUT: 'output',
  RESULT: 'result',
} as const;
export type ConsoleTab = (typeof ConsoleTab)[keyof typeof ConsoleTab];

/**
 * Panel layouts are id-keyed maps (the resizable-panels `Layout` shape)
 * rather than positional arrays, so inserting a panel later can't
 * silently reassign everyone's saved sizes.
 */
export type PanelLayout = Record<string, number>;

export const PANEL_IDS = {
  PROBLEM: 'problem',
  EDITOR_AREA: 'editor-area',
  EDITOR: 'editor',
  CONSOLE: 'console',
} as const;

export interface WorkspaceState {
  problemTab: ProblemTab;
  consoleTab: ConsoleTab;
  consoleOpen: boolean;
  /** problem | editor-area split */
  horizontalLayout: PanelLayout;
  /** editor | console split */
  verticalLayout: PanelLayout;
  revealedHints: string[];
}

const LAYOUT_KEY = 'devarena:workspace-layout';

const initialState: WorkspaceState = {
  problemTab: ProblemTab.DESCRIPTION,
  consoleTab: ConsoleTab.TESTCASES,
  consoleOpen: true,
  horizontalLayout: storage.get<PanelLayout>(`${LAYOUT_KEY}:h`, {
    [PANEL_IDS.PROBLEM]: 42,
    [PANEL_IDS.EDITOR_AREA]: 58,
  }),
  verticalLayout: storage.get<PanelLayout>(`${LAYOUT_KEY}:v`, {
    [PANEL_IDS.EDITOR]: 65,
    [PANEL_IDS.CONSOLE]: 35,
  }),
  revealedHints: [],
};

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    problemTabChanged(state, action: PayloadAction<ProblemTab>) {
      state.problemTab = action.payload;
    },
    consoleTabChanged(state, action: PayloadAction<ConsoleTab>) {
      state.consoleTab = action.payload;
      state.consoleOpen = true;
    },
    consoleToggled(state) {
      state.consoleOpen = !state.consoleOpen;
    },
    horizontalLayoutChanged(state, action: PayloadAction<PanelLayout>) {
      state.horizontalLayout = action.payload;
      storage.set(`${LAYOUT_KEY}:h`, action.payload);
    },
    verticalLayoutChanged(state, action: PayloadAction<PanelLayout>) {
      state.verticalLayout = action.payload;
      storage.set(`${LAYOUT_KEY}:v`, action.payload);
    },
    /** Hints reveal one at a time — seeing them all at once isn't a hint. */
    hintRevealed(state, action: PayloadAction<string>) {
      if (!state.revealedHints.includes(action.payload)) {
        state.revealedHints.push(action.payload);
      }
    },
    hintsReset(state) {
      state.revealedHints = [];
    },
  },
});

export const {
  problemTabChanged,
  consoleTabChanged,
  consoleToggled,
  horizontalLayoutChanged,
  verticalLayoutChanged,
  hintRevealed,
  hintsReset,
} = workspaceSlice.actions;

export const workspaceReducer = workspaceSlice.reducer;
