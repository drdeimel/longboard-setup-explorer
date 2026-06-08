/**
 * Tour definitions for the Longboard Truck Simulator.
 *
 * This is the single source of truth for all tour content.
 * To add a new tour, simply add a new object to the TOURS array below.
 * Each step needs: targetSelector, title, description, and optionally position.
 */

import type { TourDefinition } from './tourTypes'

/** All available tours. */
export const TOURS: TourDefinition[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Get an overview on the User Interface',
    steps: [
      {
        targetSelector: '[data-tour="header-title"]',
        title: 'Welcome!',
        description:
          'This is the Longboard Truck Geometry Explorer — your interactive tool for understanding how truck geometry affects steering behavior.',
        position: 'bottom',
      },
      {
        targetSelector: '[data-tour="config-panel"]',
        title: 'The Configuration Panel',
        description:
          'On the left, you can add truck parameters for multiple trucks, and select which trucks you want to visualize. Try loading a preset to get started quickly, and play with individual sliders to see how each parameter affects the geometry.',
        position: 'right',
      },
      {
        targetSelector: '[data-tour="side-view"]',
        title: 'Side View',
        description:
          'The side view shows a cross-section of your front truck. Here you can see the truck geometry when the truck is at 0° \n\nNotice the pivot axis angle (α), rake offset, trailing distance, and the effective rotation center. These are the key geometric parameters that determine how your truck steers.',
        position: 'top',
      },
      {
        targetSelector: '[data-tour="front-view"]',
        title: 'Front View',
        description:
          'The front view lets you visualize how the truck leans and steers.\n\n Try dragging the green dot! The colored lines indicate the pivot axis at different lean angles. You can see how the hanger rotates around the pivot axis as the board leans.',
        position: 'top',
      },
      {
        targetSelector: '[data-tour="top-view"]',
        title: 'Top View',
        description:
          'The top view shows you where the Instantaneous Center of Rotation (ICR) — the point around which the board turns — is, depending on the lean. Notice that it moves depending on pivot angles and rake! Play with the rear truck settings to see the effect.',
        position: 'top',
      },
      {
        targetSelector: '[data-tour="side-view-trailing"]',
        title: 'Trailing Distance',
        description:
          'This is the trailing distance: the horizontal distance from the wheel contact patch to where the pivot axis intersects the ground. It significantly affects how the truck responds to lateral forces.',
        position: 'right',
      },
      {
        targetSelector: '[data-tour="lean-vs-steer"]',
        title: 'Lean vs Steer Chart',
        description:
          'This chart shows you how much your truck steers for a given board lean angle. Different setups will show different curves — steeper curves mean more steering response per degree of lean.',
        position: 'top',
      },
    ],
  },
  {
    id: 'pendulum',
    name: 'Inverse pendulum length',
    description: 'The most important number of your setup',
    steps: [
      {
        targetSelector: '[data-tour="side-view-rotation-center"]',
        title: 'Center of Rotation',
        description:
          'The green dot in the side view indicates the center of rotation for both your lean and turn. It is the intersection of the pivot axis and the hanger\'s vertical rotation axis.',
        position: 'right',
      },
      {
        targetSelector: '[data-tour="front-view-inv-pendulum"]',
        title: 'Height of inverse pednulum',
        description:
          'Its distance to the board surface determines the feel of a setup. It creates an "inverse pendulum".\n\n Long arm: "Divey" feel (TKPs, Surfskate trucks). \n\n Short arm: "Low Deck" feel (positive-rake RKP).',
        position: 'right',
      },      {
        targetSelector: '[data-tour="config-panel"]',
        title: 'Contributing factors',
        description:
          'Baseplate height and risers influence the inverse pendulum arm. But also rake, depending on the angle of the pivot axis.\n\n Try changing those values and see their effect!',
        position: 'right',
      },
    ],
  },
  {
    id: 'trail',
    name: 'Trail',
    description: 'Lively or Stable?',
    steps: [
      {
        targetSelector: '[data-tour="side-view-trailing"]',
        title: 'Trail',
        description:
          "The distance between the ground contact of the wheels and the intersection of pivot axis and  ground is the trail. It determines how much your hanger straightens itself, even without bushings.\n\nLarge trail: self-stabilizing feedback that increases with velocity.\n\n No trail: Lively and agile setup that doesn't fight your steering inputs.",
        position: 'right',
      },
    ],
  },
  {
    id: 'surfskate-vs-ldp',
    name: 'What is the difference between Surfskate and LDP setups?',
    description: 'Understand the core geometric differences between surfskate and LDP trucks',
    steps: [
      {
        targetSelector: '[data-tour="front-view-inv-pendulum"]',
        title: 'Surfskate = long inverse pendulum arm',
        description:
          'Surfskates have a long pendulum arm, which translates small sideways forces into large steering torques. But it also couples lean and sideways force tightly.\n\n When wiggling your hip left-right, the truck steers automatically in the right direction, giving that effortless pumping feel of surfskates. \n\nWhen going faster, you need to push harder. This turns the truck faster and your pumping frequency goes up. At some point it feels like you hit a "speed wall".',
        position: 'bottom',
      },
      {
      targetSelector: '[data-tour="front-view-inv-pendulum"]',
      title: 'LDP board = short inverse pendulum',
      description:
        'LDP setups have a short pendulum arm. Throwing your hip left-right will not turn the truck much.\n\n Instead, you steer by letting your ankle rotate when your legs push left-right.\n\n While more difficult to learn, it allows you to control the steering and propulsion independently by modulating ankle stiffness. \n\n With LDP setups, starting from a standstill is challenging, but you can move much faster and way more efficiently than with surfskate setups. \n\n It also allows for many different pumping styles -- as demonstrated so nicely by Vlad Popov on Youtube.'
     },
    ],
  },
  {
    id: 'surf_feel',
    name: 'The Surf Feel',
    description: 'Why are surfskates called surfskates?',
    steps: [
      {
        targetSelector: '[data-tour="top-view"]',
        title: 'Moving ICR',
        description:
          "If frontside and backside trucks have vastly different pivot angles, then the ICR can move considerably, depending on lean. In most setups, the front truck has a high pivot axis angle and the backside truck a low angle.\n\n At a certain lean the ICR starts to aggressively migrate towards the front truck. Your back foot's lever increases while your front foot's lever shrinks. Your board feels like it breaks out in the back, a feeling similar to stalling a surf board's fins",
        position: 'right',
      },
    ],
  },
]