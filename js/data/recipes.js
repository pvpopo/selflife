/* ShelfLife — data/recipes.js
   Every ingredient references a food id from data/foods.js and its quantity is
   expressed in that food's unit ('g', 'ml', or 'ct'). Nutrition per serving is
   computed at runtime from the food catalog (see nutrition.js), so the recipe
   cards, day totals and shopping list always agree.

   diets:    vegetarian | vegan | gluten-free | dairy-free | high-protein | low-carb
   allergens: dairy | gluten | eggs | nuts | soy | fish | shellfish | sesame
   meal:     which slots this recipe can fill. */
(function (g) {
  'use strict';

  const R = [
    /* ============ breakfasts ============ */
    {
      id: 'overnight_oats', name: 'Berry overnight oats', emoji: '\u{1F353}', cuisine: 'American',
      meal: ['breakfast'], diets: ['vegetarian', 'high-protein'], allergens: ['dairy'],
      time: 10, servings: 2,
      ing: [
        { f: 'oats', q: 160 }, { f: 'milk', q: 480 }, { f: 'greek_yogurt', q: 120 },
        { f: 'honey', q: 30 }, { f: 'berries', q: 200 }, { f: 'cinnamon', q: 2 }
      ],
      steps: [
        'In a jar or bowl, stir together the oats, milk, yogurt, honey and cinnamon until evenly combined.',
        'Fold in half the berries, pressing a few against the side to bleed a little color and flavor.',
        'Cover and refrigerate at least 4 hours, ideally overnight. The oats will soften and thicken.',
        'In the morning, loosen with a splash of milk if it set too thick.',
        'Top with the remaining berries and serve cold, straight from the fridge.'
      ],
      tip: 'Keeps 3 days in the fridge, so make a double batch on Sunday and breakfast is handled through midweek.'
    },
    {
      id: 'veggie_scramble', name: 'Mushroom-spinach scramble & toast', emoji: '\u{1F373}', cuisine: 'American',
      meal: ['breakfast'], diets: ['vegetarian', 'high-protein'], allergens: ['eggs', 'dairy', 'gluten'],
      time: 15, servings: 2,
      ing: [
        { f: 'eggs', q: 6 }, { f: 'spinach', q: 80 }, { f: 'mushrooms', q: 120 },
        { f: 'cheddar', q: 60 }, { f: 'butter', q: 15 }, { f: 'bread', q: 4 },
        { f: 'salt', q: 2 }, { f: 'black_pepper', q: 1 }
      ],
      steps: [
        'Melt half the butter in a nonstick skillet over medium heat and cook the sliced mushrooms until browned, about 5 minutes.',
        'Add the spinach and stir until just wilted, about 1 minute. Push everything to one side.',
        'Whisk the eggs with the salt and pepper. Add the remaining butter to the empty side of the pan, pour in the eggs, and drop the heat to medium-low.',
        'Stir slowly with a spatula, folding the vegetables in as soft curds form, 2\u20133 minutes. Kill the heat while the eggs still look slightly glossy.',
        'Scatter the cheddar over the top, cover for 30 seconds to melt, and serve on or beside the toast.'
      ],
      tip: 'Low and slow is the whole secret to creamy eggs \u2014 they keep cooking off the heat.'
    },
    {
      id: 'yogurt_parfait', name: 'Greek yogurt parfait', emoji: '\u{1F368}', cuisine: 'American',
      meal: ['breakfast'], diets: ['vegetarian', 'high-protein'], allergens: ['dairy', 'nuts'],
      time: 5, servings: 2,
      ing: [
        { f: 'greek_yogurt', q: 400 }, { f: 'berries', q: 200 }, { f: 'honey', q: 20 },
        { f: 'almonds', q: 40 }, { f: 'oats', q: 40 }
      ],
      steps: [
        'Toast the oats and roughly chopped almonds in a dry skillet over medium heat until fragrant, 3\u20134 minutes. Let cool a minute.',
        'Spoon a layer of yogurt into two glasses, then a layer of berries, then a scatter of the toasted crunch.',
        'Repeat the layers, finishing with berries and almonds on top.',
        'Drizzle the honey over everything and serve immediately while the topping is still crisp.'
      ],
      tip: 'Toasting the oats and nuts takes 3 minutes and is the difference between a parfait and sad yogurt.'
    },
    {
      id: 'pb_banana_smoothie', name: 'Peanut butter banana smoothie', emoji: '\u{1F34C}', cuisine: 'American',
      meal: ['breakfast'], diets: ['vegetarian'], allergens: ['dairy', 'nuts'],
      time: 5, servings: 2,
      ing: [
        { f: 'banana', q: 2 }, { f: 'peanut_butter', q: 48 }, { f: 'milk', q: 480 },
        { f: 'oats', q: 30 }, { f: 'honey', q: 15 }, { f: 'cinnamon', q: 1 }
      ],
      steps: [
        'Break the bananas into chunks and add to a blender \u2014 frozen chunks make it milkshake-thick.',
        'Add the peanut butter, milk, oats, honey and cinnamon.',
        'Blend on high until completely smooth, about 45 seconds, scraping down once.',
        'Taste: more honey if your bananas were green, a splash more milk if too thick. Pour and drink cold.'
      ],
      tip: 'This is the destiny of every browning banana on the counter \u2014 peel, chunk, and freeze them before they turn.'
    },
    {
      id: 'avocado_toast_egg', name: 'Avocado toast with fried egg', emoji: '\u{1F95A}', cuisine: 'American',
      meal: ['breakfast'], diets: ['vegetarian'], allergens: ['gluten', 'eggs'],
      time: 12, servings: 2,
      ing: [
        { f: 'bread', q: 4 }, { f: 'avocado', q: 2 }, { f: 'eggs', q: 4 },
        { f: 'lemon', q: 0.5 }, { f: 'olive_oil', q: 10 }, { f: 'salt', q: 2 }, { f: 'black_pepper', q: 1 }
      ],
      steps: [
        'Toast the bread until deeply golden \u2014 it needs structure for what is coming.',
        'Halve and pit the avocados, scoop into a bowl, and mash with the lemon juice, half the salt and a good grind of pepper. Leave it chunky.',
        'Heat the olive oil in a skillet over medium-high. Crack in the eggs and fry until the whites are set but the yolks still jiggle, about 3 minutes. Season.',
        'Pile the avocado onto the toast, slide an egg on top of each, and finish with more pepper.'
      ],
      tip: 'A ripe avocado yields to gentle pressure at the stem end. Rock hard? Give it 2 days on the counter next to the bananas.'
    },
    {
      id: 'breakfast_burritos', name: 'Breakfast burritos', emoji: '\u{1F32F}', cuisine: 'Mexican',
      meal: ['breakfast'], diets: ['vegetarian', 'high-protein'], allergens: ['gluten', 'eggs', 'dairy'],
      time: 20, servings: 2,
      ing: [
        { f: 'tortillas', q: 4 }, { f: 'eggs', q: 6 }, { f: 'black_beans', q: 125 },
        { f: 'cheddar', q: 80 }, { f: 'salsa', q: 120 }, { f: 'scallions', q: 0.5 }, { f: 'butter', q: 10 }
      ],
      steps: [
        'Warm the drained black beans in a small pan with a spoonful of the salsa; keep warm.',
        'Soft-scramble the eggs in the butter over medium-low heat, pulling them off while still glossy.',
        'Warm the tortillas directly over a burner flame or in a dry skillet until pliable and spotted.',
        'Lay each tortilla flat and stack: eggs, beans, cheddar, salsa, sliced scallions \u2014 down the center third only.',
        'Fold the sides in, then roll tightly from the bottom. Sear seam-side down in the hot pan 1 minute to seal.'
      ],
      tip: 'These freeze brilliantly: wrap in foil, freeze, then reheat in a skillet or air fryer for a 5-minute weekday breakfast.'
    },

    /* ============ mains ============ */
    {
      id: 'chicken_fajita_bowls', name: 'Chicken fajita bowls', emoji: '\u{1F958}', cuisine: 'Mexican',
      meal: ['lunch', 'dinner'], diets: ['gluten-free', 'high-protein'], allergens: ['dairy'],
      time: 35, servings: 4,
      ing: [
        { f: 'chicken_breast', q: 600 }, { f: 'bell_pepper', q: 2 }, { f: 'onion', q: 1 },
        { f: 'rice', q: 300 }, { f: 'lime', q: 1 }, { f: 'cumin', q: 4 }, { f: 'chili_powder', q: 6 },
        { f: 'olive_oil', q: 20 }, { f: 'cilantro', q: 0.5 }, { f: 'sour_cream', q: 60 }, { f: 'salt', q: 3 }
      ],
      steps: [
        'Start the rice: rinse, then simmer covered with double its volume of water and a pinch of salt, 15\u201318 minutes.',
        'Slice the chicken into strips and toss with cumin, chili powder, salt and half the oil.',
        'Get a large skillet screaming hot. Sear the chicken in a single layer, undisturbed 2 minutes per side, until charred at the edges and cooked through. Remove.',
        'In the same pan, sear the sliced peppers and onion in the remaining oil until blistered but still crisp, 4\u20135 minutes.',
        'Return the chicken, squeeze the lime over everything, and toss once.',
        'Build bowls: rice, then the fajita mix, a spoon of sour cream, and torn cilantro.'
      ],
      tip: 'The char is the flavor \u2014 resist the urge to stir. A crowded pan steams; cook in two batches if needed.'
    },
    {
      id: 'sheet_pan_lemon_chicken', name: 'Sheet-pan lemon chicken & potatoes', emoji: '\u{1F34B}', cuisine: 'Mediterranean',
      meal: ['dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: [],
      time: 50, servings: 4,
      ing: [
        { f: 'chicken_thigh', q: 800 }, { f: 'potatoes', q: 800 }, { f: 'broccoli', q: 400 },
        { f: 'lemon', q: 2 }, { f: 'garlic', q: 4 }, { f: 'olive_oil', q: 30 },
        { f: 'oregano', q: 3 }, { f: 'salt', q: 4 }, { f: 'black_pepper', q: 2 }
      ],
      steps: [
        'Heat the oven to 425\u00b0F (220\u00b0C) with a rack in the upper third.',
        'Cut the potatoes into 1-inch chunks. Toss on a sheet pan with half the oil, half the salt, and the oregano. Roast 15 minutes head start.',
        'Meanwhile toss the chicken with the remaining oil, minced garlic, the zest and juice of one lemon, salt and pepper.',
        'Pull the pan out, push the potatoes to one side, and add the chicken. Roast 15 minutes.',
        'Add the broccoli florets, tossed in whatever oil is left in the bowl, and roast a final 12\u201315 minutes until the chicken hits 165\u00b0F and the broccoli tips crisp.',
        'Squeeze the second lemon over the whole pan before serving.'
      ],
      tip: 'One pan, staggered timing \u2014 potatoes always need the head start. Cleanup is a single sheet pan.'
    },
    {
      id: 'turkey_chili', name: 'Weeknight turkey chili', emoji: '\u{1F336}', cuisine: 'American',
      meal: ['lunch', 'dinner'], diets: ['gluten-free', 'high-protein'], allergens: ['dairy'],
      time: 45, servings: 4,
      ing: [
        { f: 'ground_turkey', q: 454 }, { f: 'onion', q: 1 }, { f: 'garlic', q: 3 },
        { f: 'bell_pepper', q: 1 }, { f: 'crushed_tomatoes', q: 794 }, { f: 'black_beans', q: 500 },
        { f: 'broth', q: 480 }, { f: 'chili_powder', q: 15 }, { f: 'cumin', q: 6 },
        { f: 'olive_oil', q: 15 }, { f: 'salt', q: 4 }, { f: 'cheddar', q: 60 }
      ],
      steps: [
        'Heat the oil in a heavy pot over medium-high. Brown the turkey hard, breaking it up, until you get crusty bits, 6\u20138 minutes.',
        'Add the diced onion, pepper and garlic; cook until softened, 4 minutes.',
        'Add the chili powder and cumin and stir 30 seconds to bloom the spices in the fat.',
        'Pour in the crushed tomatoes, drained beans and broth. Scrape up the browned bits.',
        'Simmer uncovered 25 minutes, stirring occasionally, until thick enough that a spoon leaves a trail. Season with salt.',
        'Serve topped with cheddar. It is even better tomorrow.'
      ],
      tip: 'Chili is a planner\u2019s best friend: it reheats better than it started and freezes for 3 months.'
    },
    {
      id: 'beef_tacos', name: 'Ground beef tacos', emoji: '\u{1F32E}', cuisine: 'Mexican',
      meal: ['dinner'], diets: ['high-protein'], allergens: ['gluten', 'dairy'],
      time: 25, servings: 4,
      ing: [
        { f: 'ground_beef', q: 454 }, { f: 'tortillas', q: 8 }, { f: 'onion', q: 0.5 },
        { f: 'romaine', q: 0.5 }, { f: 'tomato', q: 2 }, { f: 'cheddar', q: 100 },
        { f: 'salsa', q: 150 }, { f: 'chili_powder', q: 8 }, { f: 'cumin', q: 4 },
        { f: 'olive_oil', q: 10 }, { f: 'salt', q: 3 }
      ],
      steps: [
        'Cook the diced onion in the oil over medium-high until translucent, 3 minutes.',
        'Add the beef and brown thoroughly, breaking it into small crumbles, 6\u20138 minutes. Drain excess fat if you like.',
        'Stir in chili powder, cumin, salt and a splash of water; simmer 2 minutes until saucy.',
        'Warm the tortillas in a dry skillet or over a flame until soft and spotted.',
        'Set out shredded romaine, diced tomato, cheddar and salsa; build tacos at the table.'
      ],
      tip: 'Double the meat and freeze half \u2014 taco filling is next week\u2019s burrito bowl.'
    },
    {
      id: 'spaghetti_marinara', name: 'Spaghetti marinara', emoji: '\u{1F35D}', cuisine: 'Italian',
      meal: ['dinner'], diets: ['vegetarian'], allergens: ['gluten', 'dairy'],
      time: 30, servings: 4,
      ing: [
        { f: 'spaghetti', q: 454 }, { f: 'crushed_tomatoes', q: 794 }, { f: 'garlic', q: 4 },
        { f: 'onion', q: 1 }, { f: 'olive_oil', q: 30 }, { f: 'basil', q: 0.5 },
        { f: 'parmesan', q: 60 }, { f: 'salt', q: 4 }, { f: 'sugar', q: 5 }
      ],
      steps: [
        'Warm the oil, thinly sliced garlic and diced onion together in a cold pan, then bring up to medium \u2014 gentle heat, no browning, about 5 minutes.',
        'Add the crushed tomatoes, salt and sugar. Simmer gently 20 minutes, stirring now and then, until it darkens slightly and tastes cooked.',
        'Meanwhile boil the spaghetti in well-salted water until 1 minute shy of the package time. Reserve a cup of pasta water before draining.',
        'Transfer the pasta into the sauce with a splash of the starchy water and toss over heat 1 minute until glossy and clinging.',
        'Tear in the basil off the heat. Serve with parmesan grated over.'
      ],
      tip: 'Finishing the pasta in the sauce with starchy water is what restaurant pasta has that home pasta usually lacks.'
    },
    {
      id: 'creamy_tomato_pasta', name: 'Creamy tomato & spinach pasta', emoji: '\u{1F345}', cuisine: 'Italian',
      meal: ['lunch', 'dinner'], diets: ['vegetarian'], allergens: ['gluten', 'dairy'],
      time: 25, servings: 4,
      ing: [
        { f: 'spaghetti', q: 400 }, { f: 'crushed_tomatoes', q: 400 }, { f: 'spinach', q: 142 },
        { f: 'garlic', q: 3 }, { f: 'onion', q: 0.5 }, { f: 'sour_cream', q: 120 },
        { f: 'parmesan', q: 40 }, { f: 'olive_oil', q: 20 }, { f: 'oregano', q: 2 }, { f: 'salt', q: 3 }
      ],
      steps: [
        'Boil the pasta in salted water until just shy of al dente; reserve a cup of the water.',
        'Meanwhile soften the diced onion and garlic in the oil over medium heat, 4 minutes.',
        'Add crushed tomatoes, oregano and salt; simmer 8 minutes.',
        'Off the heat, stir in the sour cream until the sauce turns blush and silky (boiling it now would curdle it).',
        'Fold in the spinach and the drained pasta with a splash of pasta water; toss over low heat until the spinach wilts and the sauce clings.',
        'Serve with parmesan over the top.'
      ],
      tip: 'Sour cream is the pantry shortcut to a cream sauce \u2014 always off the boil, never into it.'
    },
    {
      id: 'tofu_stirfry', name: 'Crispy tofu veggie stir-fry', emoji: '\u{1F962}', cuisine: 'Asian',
      meal: ['lunch', 'dinner'], diets: ['vegan', 'vegetarian', 'dairy-free'], allergens: ['soy', 'gluten'],
      time: 30, servings: 4,
      ing: [
        { f: 'tofu', q: 396 }, { f: 'broccoli', q: 400 }, { f: 'bell_pepper', q: 1 },
        { f: 'carrots', q: 150 }, { f: 'garlic', q: 3 }, { f: 'ginger', q: 15 },
        { f: 'soy_sauce', q: 60 }, { f: 'sugar', q: 15 }, { f: 'rice', q: 300 },
        { f: 'olive_oil', q: 20 }, { f: 'scallions', q: 1 }
      ],
      steps: [
        'Start the rice. Press the tofu between paper towels under a heavy pan for 10 minutes, then cut into 1-inch cubes.',
        'Stir the soy sauce, sugar, and 3 tablespoons of water together for the sauce.',
        'Heat half the oil in a wide skillet over medium-high. Fry the tofu undisturbed until deep golden on two sides, 3\u20134 minutes per side. Remove.',
        'Add remaining oil, then broccoli florets, sliced pepper and carrot coins. Stir-fry 4 minutes until crisp-tender.',
        'Add minced garlic and ginger for 30 seconds, then the sauce. Let it bubble and thicken 1 minute.',
        'Return the tofu, toss to glaze, and serve over rice with sliced scallions.'
      ],
      tip: 'Gluten-free? Swap the soy sauce for tamari \u2014 everything else in this dish already qualifies.'
    },
    {
      id: 'teriyaki_salmon_bowls', name: 'Teriyaki-glazed salmon bowls', emoji: '\u{1F363}', cuisine: 'Asian',
      meal: ['dinner'], diets: ['dairy-free', 'high-protein'], allergens: ['fish', 'soy', 'gluten'],
      time: 30, servings: 4,
      ing: [
        { f: 'salmon', q: 454 }, { f: 'rice', q: 300 }, { f: 'soy_sauce', q: 45 },
        { f: 'honey', q: 25 }, { f: 'ginger', q: 10 }, { f: 'garlic', q: 2 },
        { f: 'broccoli', q: 300 }, { f: 'scallions', q: 1 }, { f: 'olive_oil', q: 10 }
      ],
      steps: [
        'Start the rice. Simmer soy sauce, honey, grated ginger and minced garlic in a small pan 2\u20133 minutes until syrupy. Reserve a spoonful.',
        'Cut the salmon into 4 portions. Steam or microwave the broccoli florets until bright green, 3 minutes.',
        'Heat the oil in a nonstick skillet over medium-high. Sear the salmon skin-side up for 3 minutes.',
        'Flip, brush generously with the glaze, and cook 3\u20134 more minutes until it flakes but is still blush in the center.',
        'Build bowls: rice, broccoli, salmon. Drizzle the reserved glaze and shower with scallions.'
      ],
      tip: 'The glaze burns fast \u2014 brush it on after the flip, not before the sear.'
    },
    {
      id: 'shrimp_fried_rice', name: 'Shrimp fried rice', emoji: '\u{1F364}', cuisine: 'Asian',
      meal: ['lunch', 'dinner'], diets: ['dairy-free', 'high-protein'], allergens: ['shellfish', 'eggs', 'soy', 'gluten'],
      time: 25, servings: 4,
      ing: [
        { f: 'shrimp', q: 340 }, { f: 'rice', q: 300 }, { f: 'eggs', q: 3 },
        { f: 'peas_frozen', q: 150 }, { f: 'carrots', q: 100 }, { f: 'garlic', q: 3 },
        { f: 'ginger', q: 10 }, { f: 'soy_sauce', q: 45 }, { f: 'scallions', q: 1 }, { f: 'olive_oil', q: 25 }
      ],
      steps: [
        'Cook the rice ahead and spread it to cool \u2014 cold, dried-out rice fries; fresh rice steams into mush.',
        'Pat the thawed shrimp very dry. Sear in half the oil over high heat 1 minute per side until just pink; remove.',
        'Scramble the eggs quickly in the pan and remove with the shrimp.',
        'Add remaining oil, then diced carrot; stir-fry 2 minutes. Add peas, garlic and ginger for 1 minute more.',
        'Add the rice, pressing it against the hot pan and letting it sit 30-second stretches to crisp. Splash in the soy sauce around the edge.',
        'Return shrimp and eggs, toss everything together, and finish with scallions.'
      ],
      tip: 'This recipe exists to eat leftover rice \u2014 the planner will happily point day-old rice here.'
    },
    {
      id: 'chicken_coconut_curry', name: 'Chicken coconut curry', emoji: '\u{1F35B}', cuisine: 'Indian',
      meal: ['dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: [],
      time: 40, servings: 4,
      ing: [
        { f: 'chicken_thigh', q: 600 }, { f: 'coconut_milk', q: 400 }, { f: 'onion', q: 1 },
        { f: 'garlic', q: 3 }, { f: 'ginger', q: 15 }, { f: 'curry_powder', q: 12 },
        { f: 'crushed_tomatoes', q: 200 }, { f: 'rice', q: 300 }, { f: 'spinach', q: 100 },
        { f: 'olive_oil', q: 15 }, { f: 'salt', q: 3 }, { f: 'cilantro', q: 0.5 }
      ],
      steps: [
        'Start the rice. Cut the chicken into bite-size pieces and season with salt.',
        'Soften the diced onion in the oil over medium heat, 5 minutes. Add minced garlic, grated ginger and the curry powder; stir 1 minute until fragrant.',
        'Add the chicken and turn to coat in the spiced onions, 2 minutes.',
        'Pour in the crushed tomatoes and coconut milk. Simmer gently, uncovered, 15\u201318 minutes until the chicken is cooked and the sauce has body.',
        'Stir in the spinach to wilt. Taste for salt.',
        'Serve over rice with torn cilantro.'
      ],
      tip: 'Blooming the curry powder in the oil for a full minute is what separates fragrant from dusty.'
    },
    {
      id: 'chickpea_coconut_curry', name: 'Chickpea coconut curry', emoji: '\u{1FAD8}', cuisine: 'Indian',
      meal: ['lunch', 'dinner'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], allergens: [],
      time: 30, servings: 4,
      ing: [
        { f: 'chickpeas', q: 500 }, { f: 'coconut_milk', q: 400 }, { f: 'onion', q: 1 },
        { f: 'garlic', q: 3 }, { f: 'ginger', q: 15 }, { f: 'curry_powder', q: 12 },
        { f: 'crushed_tomatoes', q: 300 }, { f: 'spinach', q: 142 }, { f: 'rice', q: 300 },
        { f: 'olive_oil', q: 15 }, { f: 'salt', q: 3 }
      ],
      steps: [
        'Start the rice. Soften the diced onion in the oil over medium heat, 5 minutes.',
        'Add minced garlic, grated ginger and curry powder; toast 1 minute.',
        'Add the drained chickpeas, crushed tomatoes and coconut milk. Simmer 15 minutes, mashing a few chickpeas against the pot to thicken the sauce.',
        'Stir in the spinach until wilted; season with salt.',
        'Serve over rice.'
      ],
      tip: 'Everything here but the spinach lives in the pantry \u2014 this is the recipe for the week you didn\u2019t plan.'
    },
    {
      id: 'lentil_soup', name: 'Hearty lentil soup', emoji: '\u{1F372}', cuisine: 'Mediterranean',
      meal: ['lunch', 'dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: [],
      time: 50, servings: 4,
      ing: [
        { f: 'lentils_dry', q: 300 }, { f: 'carrots', q: 200 }, { f: 'celery', q: 150 },
        { f: 'onion', q: 1 }, { f: 'garlic', q: 3 }, { f: 'crushed_tomatoes', q: 300 },
        { f: 'broth', q: 907 }, { f: 'cumin', q: 4 }, { f: 'oregano', q: 2 },
        { f: 'olive_oil', q: 20 }, { f: 'salt', q: 4 }, { f: 'lemon', q: 1 }
      ],
      steps: [
        'Sweat the diced onion, carrot and celery in the oil over medium heat until softened, 8 minutes.',
        'Add the garlic, cumin and oregano; stir 1 minute.',
        'Add the rinsed lentils, crushed tomatoes, broth and 2 cups of water. Bring to a boil, then simmer partially covered.',
        'Cook 30\u201335 minutes until the lentils are tender and the soup has thickened, adding water if it gets stew-thick.',
        'Season with salt and finish with the juice of the lemon \u2014 do not skip it; the acid wakes the whole pot up.'
      ],
      tip: 'Swap in vegetable broth and this becomes fully vegan. It also freezes flawlessly for 3 months.'
    },
    {
      id: 'greek_chicken_salad', name: 'Greek chicken salad with pita', emoji: '\u{1F957}', cuisine: 'Mediterranean',
      meal: ['lunch', 'dinner'], diets: ['high-protein'], allergens: ['dairy', 'gluten'],
      time: 30, servings: 4,
      ing: [
        { f: 'chicken_breast', q: 500 }, { f: 'romaine', q: 1 }, { f: 'cucumber', q: 1 },
        { f: 'cherry_tomatoes', q: 283 }, { f: 'feta', q: 100 }, { f: 'onion', q: 0.25 },
        { f: 'olive_oil', q: 45 }, { f: 'lemon', q: 1 }, { f: 'oregano', q: 3 },
        { f: 'pita', q: 4 }, { f: 'salt', q: 3 }
      ],
      steps: [
        'Season the chicken with salt and half the oregano. Sear in a little of the oil over medium-high, 5\u20136 minutes per side, until 165\u00b0F. Rest 5 minutes, then slice.',
        'Whisk the remaining oil with the lemon juice, remaining oregano, and a pinch of salt.',
        'Chop the romaine, halve the cherry tomatoes, slice the cucumber and very thinly slice the onion.',
        'Toss the vegetables with most of the dressing; top with sliced chicken and crumbled feta, and drizzle the rest over.',
        'Toast the pitas in a dry pan until warm and puffed; cut into wedges for scooping.'
      ],
      tip: 'Skip the pita and it\u2019s naturally gluten-free \u2014 the salad stands on its own.'
    },
    {
      id: 'hummus_veggie_pitas', name: 'Loaded hummus veggie pitas', emoji: '\u{1F959}', cuisine: 'Mediterranean',
      meal: ['lunch'], diets: ['vegan', 'vegetarian', 'dairy-free'], allergens: ['gluten', 'sesame'],
      time: 15, servings: 4,
      ing: [
        { f: 'pita', q: 4 }, { f: 'hummus', q: 283 }, { f: 'cucumber', q: 1 },
        { f: 'tomato', q: 2 }, { f: 'spinach', q: 60 }, { f: 'carrots', q: 100 },
        { f: 'lemon', q: 0.5 }, { f: 'olive_oil', q: 10 }
      ],
      steps: [
        'Warm the pitas until soft, then halve them into pockets.',
        'Slice the cucumber and tomatoes thin; shred or ribbon the carrot with a peeler.',
        'Toss the vegetables and spinach with the olive oil, a squeeze of lemon, and a pinch of salt.',
        'Spread a thick layer of hummus inside each pocket \u2014 it is the glue and the protein.',
        'Stuff generously with the dressed vegetables and eat immediately, over a plate.'
      ],
      tip: 'The hummus layer goes on both inner walls of the pocket \u2014 it waterproofs the bread against the tomatoes.'
    },
    {
      id: 'burrito_bowls', name: 'Black bean burrito bowls', emoji: '\u{1F951}', cuisine: 'Mexican',
      meal: ['lunch', 'dinner'], diets: ['vegetarian', 'gluten-free'], allergens: ['dairy'],
      time: 30, servings: 4,
      ing: [
        { f: 'rice', q: 300 }, { f: 'black_beans', q: 500 }, { f: 'corn_frozen', q: 200 },
        { f: 'salsa', q: 200 }, { f: 'avocado', q: 2 }, { f: 'romaine', q: 0.5 },
        { f: 'lime', q: 1 }, { f: 'cheddar', q: 80 }, { f: 'cilantro', q: 0.5 },
        { f: 'cumin', q: 3 }, { f: 'olive_oil', q: 10 }, { f: 'salt', q: 3 }
      ],
      steps: [
        'Cook the rice; when done, fluff with the juice of half the lime, chopped cilantro stems and a pinch of salt.',
        'Warm the drained beans in the oil with the cumin and a splash of water until saucy, 5 minutes.',
        'Char the corn in a dry hot skillet until spotted, 3\u20134 minutes.',
        'Slice the avocados and shred the romaine.',
        'Build bowls: lime rice, beans, corn, romaine, avocado, salsa, cheddar, cilantro leaves, and the last lime wedges.'
      ],
      tip: 'Skip the cheese and it\u2019s vegan. Add leftover taco meat or fajita chicken and it\u2019s a new dinner \u2014 this bowl absorbs leftovers.'
    },
    {
      id: 'stuffed_peppers', name: 'Turkey & rice stuffed peppers', emoji: '\u{1FAD1}', cuisine: 'American',
      meal: ['dinner'], diets: ['gluten-free', 'high-protein'], allergens: ['dairy'],
      time: 55, servings: 4,
      ing: [
        { f: 'bell_pepper', q: 4 }, { f: 'ground_turkey', q: 454 }, { f: 'rice', q: 150 },
        { f: 'onion', q: 0.5 }, { f: 'garlic', q: 2 }, { f: 'crushed_tomatoes', q: 300 },
        { f: 'mozzarella', q: 100 }, { f: 'oregano', q: 3 }, { f: 'olive_oil', q: 15 }, { f: 'salt', q: 3 }
      ],
      steps: [
        'Heat the oven to 400\u00b0F (200\u00b0C). Cook the rice. Halve the peppers through the stem and pull out the seeds.',
        'Brown the turkey in the oil with the diced onion, 6 minutes; add garlic and oregano for 1 minute more.',
        'Stir in the cooked rice, two-thirds of the crushed tomatoes, and the salt. Simmer 3 minutes.',
        'Spread the remaining tomatoes in a baking dish, nestle in the pepper halves, and pack them with the filling.',
        'Cover with foil and bake 25 minutes. Uncover, top with mozzarella, and bake 10 more until blistered.',
      ],
      tip: 'Peppers going soft in the crisper drawer? This is their retirement plan \u2014 slightly wrinkly peppers roast up perfectly.'
    },
    {
      id: 'baked_salmon_veg', name: 'Baked salmon, sweet potato & broccoli', emoji: '\u{1F41F}', cuisine: 'American',
      meal: ['dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: ['fish'],
      time: 40, servings: 4,
      ing: [
        { f: 'salmon', q: 454 }, { f: 'sweet_potatoes', q: 600 }, { f: 'broccoli', q: 400 },
        { f: 'olive_oil', q: 30 }, { f: 'lemon', q: 1 }, { f: 'garlic', q: 2 },
        { f: 'salt', q: 3 }, { f: 'black_pepper', q: 2 }
      ],
      steps: [
        'Heat the oven to 425\u00b0F (220\u00b0C). Cube the sweet potatoes, toss with half the oil and salt, and roast 15 minutes.',
        'Toss the broccoli with most of the remaining oil. Rub the salmon with the last of it, minced garlic, salt, pepper and lemon zest.',
        'Add the broccoli to the pan, clear a space, and lay the salmon portions skin-side down.',
        'Roast 12\u201314 minutes until the salmon flakes with a fork and the broccoli edges char.',
        'Squeeze the lemon over the entire pan and serve.'
      ],
      tip: 'Salmon is done at 125\u2013130\u00b0F internal for a silky center \u2014 it climbs a few degrees after it leaves the oven.'
    },
    {
      id: 'quinoa_power_bowls', name: 'Quinoa power bowls', emoji: '\u{1F33E}', cuisine: 'Mediterranean',
      meal: ['lunch', 'dinner'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], allergens: ['sesame'],
      time: 25, servings: 4,
      ing: [
        { f: 'quinoa', q: 250 }, { f: 'chickpeas', q: 250 }, { f: 'avocado', q: 1 },
        { f: 'cherry_tomatoes', q: 200 }, { f: 'cucumber', q: 1 }, { f: 'spinach', q: 100 },
        { f: 'lemon', q: 1 }, { f: 'olive_oil', q: 40 }, { f: 'hummus', q: 120 }, { f: 'salt', q: 2 }
      ],
      steps: [
        'Rinse the quinoa well, then simmer with double its volume of water, covered, 15 minutes. Rest 5, fluff.',
        'Crisp the drained chickpeas in half the oil in a skillet over medium-high with a pinch of salt, 6\u20138 minutes, until golden and popping.',
        'Whisk the remaining oil with the lemon juice and salt.',
        'Halve the tomatoes, dice the cucumber, slice the avocado.',
        'Build bowls on a bed of spinach and warm quinoa; add the vegetables, chickpeas, a generous swoosh of hummus, and the lemon dressing.'
      ],
      tip: 'Rinsing quinoa removes its bitter saponin coating \u2014 30 seconds under the tap changes the whole flavor.'
    },
    {
      id: 'chicken_rice_soup', name: 'Chicken & rice soup', emoji: '\u{1F35A}', cuisine: 'American',
      meal: ['lunch', 'dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: [],
      time: 45, servings: 4,
      ing: [
        { f: 'chicken_breast', q: 400 }, { f: 'rice', q: 150 }, { f: 'carrots', q: 200 },
        { f: 'celery', q: 150 }, { f: 'onion', q: 1 }, { f: 'garlic', q: 3 },
        { f: 'broth', q: 907 }, { f: 'oregano', q: 2 }, { f: 'olive_oil', q: 15 },
        { f: 'lemon', q: 0.5 }, { f: 'salt', q: 4 }
      ],
      steps: [
        'Sweat the diced onion, carrot and celery in the oil over medium heat until soft, 8 minutes. Add garlic and oregano for 1 minute.',
        'Add the broth plus 2 cups of water and bring to a simmer.',
        'Slip in the whole chicken breasts and the rinsed rice. Simmer gently 18\u201320 minutes until the chicken is cooked through.',
        'Lift out the chicken, shred it with two forks, and return it to the pot.',
        'Season with salt and brighten with the lemon juice before serving.'
      ],
      tip: 'Poaching the chicken whole in the broth keeps it tender and seasons the soup at the same time.'
    },
    {
      id: 'turkey_zucchini_skillet', name: 'Turkey zucchini skillet', emoji: '\u{1F958}', cuisine: 'Italian',
      meal: ['dinner'], diets: ['gluten-free', 'high-protein', 'low-carb'], allergens: ['dairy'],
      time: 25, servings: 4,
      ing: [
        { f: 'ground_turkey', q: 454 }, { f: 'zucchini', q: 2 }, { f: 'onion', q: 0.5 },
        { f: 'garlic', q: 3 }, { f: 'crushed_tomatoes', q: 400 }, { f: 'oregano', q: 3 },
        { f: 'olive_oil', q: 15 }, { f: 'parmesan', q: 40 }, { f: 'salt', q: 3 }
      ],
      steps: [
        'Brown the turkey hard in the oil over medium-high heat, breaking it up, 6 minutes.',
        'Add the diced onion and cook 3 minutes; add garlic and oregano for 1 minute.',
        'Add the zucchini in half-moons and the crushed tomatoes. Simmer 8\u201310 minutes until the zucchini is tender but not collapsing.',
        'Season with salt, shower with parmesan, and serve straight from the skillet.'
      ],
      tip: 'One pan, 25 minutes, low-carb \u2014 and it happily accepts any vegetable that needs using up.'
    },
    {
      id: 'veggie_quesadillas', name: 'Loaded veggie quesadillas', emoji: '\u{1F9C0}', cuisine: 'Mexican',
      meal: ['lunch', 'dinner'], diets: ['vegetarian'], allergens: ['gluten', 'dairy'],
      time: 25, servings: 4,
      ing: [
        { f: 'tortillas', q: 8 }, { f: 'cheddar', q: 200 }, { f: 'bell_pepper', q: 1 },
        { f: 'onion', q: 0.5 }, { f: 'corn_frozen', q: 150 }, { f: 'black_beans', q: 250 },
        { f: 'salsa', q: 150 }, { f: 'olive_oil', q: 10 }, { f: 'cumin', q: 3 }
      ],
      steps: [
        'Saut\u00e9 the sliced pepper and onion in the oil until soft and browned at the edges, 6 minutes. Add corn, drained beans and cumin; cook 2 minutes. ',
        'Lay out 4 tortillas. Cover each with cheddar edge to edge, then the vegetable mix, then a little more cheddar \u2014 cheese on both sides is the glue.',
        'Top with the remaining tortillas.',
        'Toast in a dry skillet over medium heat, pressing gently, 2\u20133 minutes per side until golden and fused.',
        'Rest 2 minutes (they slice cleaner), cut into wedges, and serve with salsa.'
      ],
      tip: 'Medium heat, not high: the cheese needs time to melt before the tortilla burns.'
    },
    {
      id: 'mushroom_spinach_omelet', name: 'Mushroom & spinach omelet', emoji: '\u{1F344}', cuisine: 'American',
      meal: ['breakfast', 'lunch'], diets: ['vegetarian', 'gluten-free', 'low-carb', 'high-protein'], allergens: ['eggs', 'dairy'],
      time: 15, servings: 2,
      ing: [
        { f: 'eggs', q: 6 }, { f: 'mushrooms', q: 150 }, { f: 'spinach', q: 80 },
        { f: 'cheddar', q: 60 }, { f: 'butter', q: 15 }, { f: 'salt', q: 2 }, { f: 'black_pepper', q: 1 }
      ],
      steps: [
        'Saut\u00e9 the sliced mushrooms in half the butter over medium-high until browned, 5 minutes. Wilt in the spinach, season, and set the filling aside.',
        'Whisk 3 eggs per omelet with a pinch of salt until fully blended.',
        'Melt a knob of butter in a nonstick skillet over medium. Pour in the eggs and drag the edges toward the center as they set, tilting to fill the gaps.',
        'When the top is nearly set but still glossy, lay filling and cheddar over one half.',
        'Fold, slide onto a plate, and repeat for the second omelet.'
      ],
      tip: 'The pan is ready when a drop of egg sizzles gently \u2014 aggressive heat makes rubber, not silk.'
    }
  ];

  const map = {};
  R.forEach((r) => { map[r.id] = r; });

  const DIETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'high-protein', 'low-carb'];
  const ALLERGENS = ['dairy', 'gluten', 'eggs', 'nuts', 'soy', 'fish', 'shellfish', 'sesame'];

  const api = { list: R, byId: (id) => map[id], DIETS, ALLERGENS, CUISINES: [] };

  function refreshCuisines() {
    api.CUISINES = Array.from(new Set(R.map((r) => r.cuisine))).sort();
  }
  refreshCuisines();

  /* Merge remote recipes (recipedb.js) over the built-ins. A remote doc with
     a known id replaces the built-in; unknown ingredient ids are rejected so
     a bad submission can never break nutrition math or shopping lists. */
  api.register = function (docs) {
    const FOODS = g.SL.foods;
    let accepted = 0;
    (docs || []).forEach((r) => {
      if (!r || !r.id || !r.name || !Array.isArray(r.ing) || !Array.isArray(r.steps)) return;
      if (!r.ing.length || !r.steps.length || !Array.isArray(r.meal) || !r.meal.length) return;
      if (r.ing.some((ing) => !FOODS.byId(ing.f) || !(ing.q > 0))) return;
      r.diets = Array.isArray(r.diets) ? r.diets.filter((d) => DIETS.includes(d)) : [];
      r.allergens = Array.isArray(r.allergens) ? r.allergens.filter((a) => ALLERGENS.includes(a)) : [];
      if (map[r.id]) {
        const i = R.indexOf(map[r.id]);
        if (i >= 0) R[i] = r; else R.push(r);
      } else R.push(r);
      map[r.id] = r;
      accepted++;
    });
    refreshCuisines();
    return accepted;
  };

  g.SL = g.SL || {};
  g.SL.recipes = api;
})(typeof window !== 'undefined' ? window : globalThis);
