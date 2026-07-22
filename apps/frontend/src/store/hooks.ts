import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './index.js';

/** Pre-typed hooks so components never re-annotate RootState/AppDispatch. */
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector = useSelector.withTypes<RootState>();
