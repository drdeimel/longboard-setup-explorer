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
          'This is the Longboard Setup Explorer — your interactive tool for understanding how truck geometry affects steering behavior.',
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
          'The side view shows a cross-section of your front truck at the current lean angle. Notice the pivot axis angle (α), rake offset, trailing distance, and the effective rotation center. These are key geometric parameters that determine how your truck steers.',
        position: 'top',
      },
      {
        targetSelector: '[data-tour="front-view"]',
        title: 'Front View',
        description:
          'The front view lets you visualize how the truck leans and steers. In Manual lean motion, drag the colored dot on the board to change the lean angle. The board, hanger, and wheels update as the board leans.',
        position: 'top',
      },
      {
        targetSelector: '[data-tour="top-view"]',
        title: 'Top View',
        description:
          'The top view shows the pumping gear ratio windroses, turning arc, and the Instantaneous Center of Rotation (ICR) — the point around which the board turns — for the current lean. The ICR moves depending on pivot angles and rake. Play with the rear truck settings to see the effect.',
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
          'The colored dot in the side view indicates the center of rotation for both your lean and turn. It is the intersection of the pivot axis and the hanger\'s vertical rotation axis.',
        position: 'right',
      },
      {
        targetSelector: '[data-tour="front-view-inv-pendulum"]',
        title: 'Height of inverse pendulum',
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
  {
    id: 'stiff-or-loose',
    name: 'Stiff or loose Board?',
    description: 'Understand what determines your board\'s rotational stiffness',
    steps: [
      {
        targetSelector: '[data-tour="rotational-stiffness-chart"]',
        title: 'Total rotational stiffness',
        description:
          'Total rotational stiffness determines how much you need to increase the sideways force to increase the board lean. It determines whether your board feels stiff or loose at a specific lean angle.',
        position: 'top',
      },
      {
        targetSelector: '[data-tour="bushings"]',
        title: 'Road- & Boardside bushings',
        description:
          'Bushings modify your board\'s stiffness in several ways.\n\nDurometer determines how hard or soft the bushing rubber is on average.\n\nBushing shape determines how stiffness changes with lean - cones will be much softer close to 0°, while barrels feel similar at multiple angles. Taller bushings push the inevitable compressive stiffening to larger lean angles.',
        position: 'right',
      },
      {
        targetSelector: '[data-tour="rider-mass"]',
        title: 'Rider weight',
        description:
          'The rider weight influences stiffness too. The rider\'s weight pushes on the inverse pendulum, which reduces stiffness with increasing weight, due to an effect called geometric stiffness. If total stiffness gets close to or falls below zero, e.g. by using two soft cones, moving straight becomes very difficult.',
        position: 'right',
      },
      {
        targetSelector: '[data-tour="pivot-axis-angle"]',
        title: 'Pivot Axis Angle',
        description:
          "To further complicate things, the truck's pivot angle also influences stiffness. If you increase your truck\'s angle, e.g. via angled risers, your setup will stiffen. If you de-wedge, your setup will soften.",
        position: 'right',
      },
      {
        targetSelector: '[data-tour="front-view-inv-pendulum"]',
        title: 'Inverse Pendulum height',
        description:
          "Finally, the inverse pendulum height also affects stiffness - by increasing or reducing the lever for the rider's weight.",
        position: 'right',
      },
    ],
  },
  {
    id: 'how-to-switch-gears',
    name: 'How to switch gears',
    description: 'Learn how pivot angle and lean change your pumping gear',
    steps: [
      {
        targetSelector: '[data-tour="side-view-pivot-axis"]',
        title: 'Pivot axis angle',
        description:
          'The pivot axis acts as your transmission box. The higher the angle, the lower is your "gear", making it easier to propel yourself forward. But it also lowers the ceiling for how fast you can pump.',
        position: 'right',
      },
      {
        targetSelector: '[data-tour="steering-angle-slider"]',
        title: 'Steering chart lean',
        description:
          'Lean is your gearshift lever: Lean your board more at each turn, and you will have a higher ratio between applied sideways force and the resulting forward propulsive force. With high lean, you have a "lower gear" and find it easier to pump, especially at low speeds.\n\nBe aware though, the same ratio applies to velocities but in reverse: More lean will also translate your forward velocity into more sideways velocity. So to keep wiggle frequency manageable, the faster you go the less you lean your board.',
        position: 'right',
      },
      {
        targetSelector: '[data-tour="front-lever-windrose"]',
        title: 'Front truck lever windrose',
        description:
          'This windrose visualizes the amount of forward propulsive force generated by a force applied in the direction of the respective windrose leaf.\nThe larger the leaf, the more propulsive power you can create with a fixed/limited (muscle) force.\n\nThe two perpendicular leaves are especially interesting: These tell you how fast your board moves sideways for the given lean. They also tell you the multiplier from sideways to propulsive force.\n\nThe catch? The total sum of applied forces needs to cancel or else you will fall off your board. You have to figure out a clever combination of force and lean oscillations that gives you a nonzero forward force average.',
        position: 'right',
      },
    ],
  },
]
