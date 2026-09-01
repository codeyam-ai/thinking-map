import { describe, expect, it } from 'vitest';
import { mapCaption } from './mapCaption';

// The caption is the map narrating itself. The design system requires it to
// always say something TRUE about the current state, so these cases are about
// truthfulness, not phrasing.
describe('mapCaption', () => {
  const node = (kind: string, status: string) => ({ kind, status });

  // A map that is only an idea has nothing to report yet, and claiming
  // progress would be the first thing the person notices as false.
  it('describes a bare seed when only the idea exists', () => {
    expect(mapCaption([node('idea', 'answered')])).toBe(
      'one seed, nothing else yet',
    );
  });

  // The caption renders before any node exists, so it must not divide by zero
  // or read as though work had happened.
  it('describes an empty map as a bare seed too', () => {
    expect(mapCaption([])).toBe('one seed, nothing else yet');
  });

  // Right after the deconstruct turn the map is all questions; the count is
  // what tells the person how much is still unknown.
  it('counts open questions while nothing has been answered', () => {
    const nodes = [
      node('idea', 'answered'),
      node('open-question', 'open'),
      node('open-question', 'open'),
      node('open-question', 'open'),
    ];
    expect(mapCaption(nodes)).toBe('one seed, 3 open questions');
  });

  // "1 open questions" would undercut the care the rest of the copy takes.
  it('singularises a lone open question', () => {
    expect(mapCaption([node('idea', 'answered'), node('open-question', 'open')])).toBe(
      'one seed, 1 open question',
    );
  });

  // The mid-conversation state the mockups show: some answers in, some still
  // outstanding.
  it('reports the answered/open split once both exist', () => {
    const nodes = [
      node('idea', 'answered'),
      node('assumption', 'answered'),
      node('problem', 'answered'),
      node('goal', 'open'),
    ];
    expect(mapCaption(nodes)).toBe('2 answered, 1 still open');
  });

  // The idea is the map's subject, not one of its findings — counting it would
  // overstate progress by one on every single map.
  it('does not count the root idea as an answered node', () => {
    const nodes = [node('idea', 'answered'), node('problem', 'answered')];
    expect(mapCaption(nodes)).toBe('grows as you talk');
  });

  // After a direction change the reassurance matters more than the counts:
  // the person needs to know their original idea survived.
  it('reports that nothing was lost when something was just updated', () => {
    const nodes = [
      node('idea', 'answered'),
      node('user', 'updated'),
      node('approach', 'answered'),
    ];
    expect(mapCaption(nodes)).toBe('nothing gets lost, only added');
  });

  // A change the person just made is the most important thing on screen, so it
  // outranks the arithmetic.
  it('prefers the just-updated line over the answered/open split', () => {
    const nodes = [
      node('idea', 'answered'),
      node('user', 'updated'),
      node('goal', 'open'),
    ];
    expect(mapCaption(nodes)).toBe('nothing gets lost, only added');
  });
});
