// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, renderHook, act } from '@testing-library/react';
import { JUDGE_LABELS, t, L, nQuestions } from './labels';
import { useJudgeLang } from './useJudgeLang';
import { useIsPhone } from './useIsPhone';
import WelcomeScreen from './WelcomeScreen';

afterEach(() => { cleanup(); localStorage.clear(); });

describe('labels table', () => {
  it('every key has non-empty en and ar strings', () => {
    for (const [k, v] of Object.entries(JUDGE_LABELS)) {
      expect(v.en.length, k).toBeGreaterThan(0);
      expect(v.ar.length, k).toBeGreaterThan(0);
    }
  });
  it('t resolves the selected language', () => {
    expect(t('finish', 'en')).toBe('Finish');
    expect(t('finish', 'ar')).toBe('إنهاء');
  });
  it('L renders only the selected language, Arabic in an rtl span', () => {
    render(<L k="finish" lang="ar" />);
    const span = screen.getByText('إنهاء');
    expect(span.getAttribute('dir')).toBe('rtl');
    expect(span.getAttribute('lang')).toBe('ar');
    expect(screen.queryByText('Finish')).toBeNull();
  });
});

describe('nQuestions', () => {
  it('formats en and ar with western numerals', () => {
    expect(nQuestions(3, 'en')).toBe('3 questions');
    expect(nQuestions(3, 'ar')).toBe('3 أسئلة');
  });
});

describe('dqBody', () => {
  it('carries an {n} slot in both languages', () => {
    expect(JUDGE_LABELS.dqBody.en).toContain('{n}');
    expect(JUDGE_LABELS.dqBody.ar).toContain('{n}');
  });
});

describe('useJudgeLang', () => {
  it('defaults to en and persists changes', () => {
    const { result } = renderHook(() => useJudgeLang());
    expect(result.current.lang).toBe('en');
    act(() => result.current.setLang('ar'));
    expect(result.current.lang).toBe('ar');
    const again = renderHook(() => useJudgeLang());
    expect(again.result.current.lang).toBe('ar');
  });
  it('survives a broken localStorage read', () => {
    localStorage.setItem('judge-lang', 'zz');
    const { result } = renderHook(() => useJudgeLang());
    expect(result.current.lang).toBe('en');
  });
});

describe('WelcomeScreen greeting', () => {
  it('renders "Welcome, {name}" in English by default, and the Arabic greeting once judge-lang is ar', () => {
    render(<WelcomeScreen name="Test" subtitle="" onStart={() => {}} />);
    expect(screen.getByText('Welcome, Test')).toBeTruthy();
    cleanup();
    localStorage.setItem('judge-lang', 'ar');
    render(<WelcomeScreen name="Test" subtitle="" onStart={() => {}} />);
    const greeting = screen.getByText('مرحبًا، Test');
    expect(greeting.getAttribute('dir')).toBe('rtl');
    expect(greeting.getAttribute('lang')).toBe('ar');
    expect(screen.queryByText('Welcome, Test')).toBeNull();
  });
});

describe('useIsPhone', () => {
  it('defaults to desktop when matchMedia is unavailable', () => {
    const orig = window.matchMedia;
    // @ts-expect-error simulate jsdom without matchMedia
    delete window.matchMedia;
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);
    window.matchMedia = orig;
  });
});
