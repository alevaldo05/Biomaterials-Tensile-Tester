/* The words of the app preview (the build published with the website at app/). Kept in one place so they can be
   edited without touching the layout. Links are relative: the website is one folder up from the app. */
import type { TestType } from '@tensile/core';

export interface PreviewLink { label: string; href: string }

export const PREVIEW = {
  badge: 'App preview · simulated data',
  introTitle: 'About this preview',
  intro: [
    'This is the tester app running on made-up data, so you can see how a test is run: enter the specimen, start recording, watch the curve, and read the key results.',
    'Real tests use the app installed on the lab computer, connected to the tester. Everything here is labeled "Simulated data, not measured".',
  ],
  introLinks: [
    { label: 'Background: why tensile testing matters', href: '../about.html#why-title' },
    { label: 'Glossary', href: '../learn.html#gloss-title' },
  ] as PreviewLink[],
  simulator: 'A pretend acquisition board is connected for you. On the lab computer you would choose the tester’s USB connection and check its calibration first.',
  steps: {
    test: {
      why: (t: TestType) => t === 'relaxation'
        ? 'A stress relaxation test stretches the specimen to a set displacement and holds it, recording how the force falls with time. The material and the speed are written into the record.'
        : 'A uniaxial tension test pulls the specimen at a steady speed until it fails. The material and the speed are written into the record; the tester’s own controller sets the speed.',
      link: (t: TestType): PreviewLink => ({ label: 'Protocol: specimen and equipment', href: t === 'relaxation' ? '../protocol-stress-relaxation.html#general/setup' : '../protocol-uniaxial-tension.html#general/setup' }),
    },
    dimensions: {
      why: () => 'Stress is force divided by the cross-section (width × thickness), and strain is the stretch divided by the gauge length, so these three numbers turn force and displacement into a stress-strain curve.',
      link: (): PreviewLink => ({ label: 'Glossary: stress, strain, gauge length', href: '../learn.html#gloss-title' }),
    },
    review: {
      why: () => 'On a real tester you would now press Start recording here and then start the test on the tester’s own controller. In this preview, Start recording also starts the pretend test.',
      link: (): PreviewLink => ({ label: 'Before you test (checklist)', href: '../learn.html#before-title' }),
    },
  } as Record<'test' | 'dimensions' | 'review', { why: (t: TestType) => string; link: (t: TestType) => PreviewLink }>,
  curve: {
    uniaxial: {
      title: 'Reading the curve',
      text: 'Soft tissue first stretches easily (the toe), then stiffens into a nearly straight part whose slope is the modulus estimate. The highest point is the ultimate tensile strength; the sudden drop is where the specimen failed. Move over the curve to read a point; the cursor snaps to the key results.',
      link: { label: 'What a tensile test measures', href: '../about.html#measures-title' },
    },
    relaxation: {
      title: 'Reading the curve',
      text: 'The stress rises while the specimen is stretched (the ramp), then falls while the stretch is held (the hold). How much it falls, and how fast, describes how the tissue relaxes.',
      link: { label: 'Stress relaxation and creep', href: '../about.html#time-title' },
    },
  } as Record<TestType, { title: string; text: string; link: PreviewLink }>,
  replay: 'Replay a saved session file',
  backToSimulator: 'Back to the simulator',
};
