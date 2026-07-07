/* ShelfLife â€” dev/seed-recipes.js
   The recipe-batch pipeline: author recipe docs here (or paste generated
   batches), run `node dev/seed-recipes.js`, and it
     1. validates every doc against the food catalog (unknown ingredients,
        missing steps, insane calories are rejected loudly),
     2. prints a per-recipe nutrition + diet coverage report,
     3. writes dev/seed-recipes.sql â€” upsert statements to paste into the
        Supabase SQL editor (status 'approved', visible to everyone).
   Recipes are original, modeled on canonical widely-loved dishes; star
   ratings are earned in-app via recipe_ratings, never invented. */
'use strict';
const fs = require('fs');
const path = require('path');

/* browser shim, same as validate.js */
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] || null,
  get length() { return Object.keys(mem).length; }
};
const root = path.join(__dirname, '..');
['js/util.js', 'js/data/foods.js', 'js/data/recipes.js', 'js/nutrition.js'].forEach((f) => {
  eval(fs.readFileSync(path.join(root, f), 'utf8'));
});
const SL = globalThis.SL;

/* ============================ THE BATCH ============================ */
const SEED = [
  /* ---------- American ---------- */
  {
    id: 'turkey_black_bean_chili', name: 'Turkey & black bean chili', emoji: 'ðŸŒ¶ï¸', cuisine: 'American',
    meal: ['dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: [],
    time: 45, servings: 4,
    ing: [
      { f: 'ground_turkey', q: 500 }, { f: 'black_beans', q: 400 }, { f: 'crushed_tomatoes', q: 400 },
      { f: 'onion', q: 1 }, { f: 'garlic', q: 0.3 }, { f: 'bell_pepper', q: 1 },
      { f: 'chili_powder', q: 8 }, { f: 'cumin', q: 5 }, { f: 'broth', q: 400 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Warm the oil in a heavy pot over medium-high. Brown the turkey, breaking it up, about 5 minutes.',
      'Add the diced onion and bell pepper; cook until soft, 4 minutes. Stir in the minced garlic, chili powder and cumin for 30 seconds until fragrant.',
      'Pour in the crushed tomatoes, broth and drained beans. Bring to a simmer.',
      'Drop the heat to low and simmer uncovered 25 minutes, stirring now and then, until thick.',
      'Taste, season, and serve â€” it is even better the next day.'
    ],
    tip: 'Freezes beautifully in single portions for no-effort future dinners.'
  },
  {
    id: 'cobb_chicken_salad', name: 'Chopped chicken Cobb salad', emoji: 'ðŸ¥—', cuisine: 'American',
    meal: ['lunch', 'dinner'], diets: ['gluten-free', 'low-carb', 'high-protein'], allergens: ['eggs', 'dairy'],
    time: 25, servings: 2,
    ing: [
      { f: 'chicken_breast', q: 300 }, { f: 'romaine', q: 1 }, { f: 'eggs', q: 2 },
      { f: 'avocado', q: 1 }, { f: 'cherry_tomatoes', q: 0.5 }, { f: 'cheddar', q: 40 },
      { f: 'olive_oil', q: 20 }, { f: 'lemon', q: 0.5 }
    ],
    steps: [
      'Hard-boil the eggs (10 minutes), cool in cold water, peel and quarter.',
      'Season the chicken and sear in a skillet over medium-high, 5â€“6 minutes per side, until cooked through. Rest, then slice.',
      'Chop the romaine and arrange in wide bowls. Halve the tomatoes, dice the avocado.',
      'Row up the chicken, eggs, avocado, tomatoes and cheddar over the lettuce.',
      'Whisk the olive oil with the lemonâ€™s juice, a pinch of salt and pepper; dress just before eating.'
    ],
    tip: 'Everything but the avocado and dressing can be prepped a day ahead.'
  },
  {
    id: 'banana_oat_pancakes', name: 'Banana oat pancakes', emoji: 'ðŸ¥ž', cuisine: 'American',
    meal: ['breakfast'], diets: ['vegetarian'], allergens: ['eggs', 'dairy'],
    time: 20, servings: 2,
    ing: [
      { f: 'banana', q: 2 }, { f: 'oats', q: 120 }, { f: 'eggs', q: 2 },
      { f: 'milk', q: 120 }, { f: 'cinnamon', q: 2 }, { f: 'butter', q: 10 }, { f: 'honey', q: 20 }
    ],
    steps: [
      'Blitz the oats in a blender until floury. Add the bananas, eggs, milk and cinnamon; blend until smooth. Rest 5 minutes to thicken.',
      'Heat a nonstick skillet over medium and slick with a little butter.',
      'Pour quarter-cup rounds and cook until bubbles pop on top, about 2 minutes.',
      'Flip and cook 1â€“2 minutes more until golden.',
      'Stack and finish with the honey.'
    ],
    tip: 'Spottier bananas mean sweeter pancakes â€” this is what those two sad ones are for.'
  },

  /* ---------- Asian ---------- */
  {
    id: 'chicken_fried_rice', name: 'Better-than-takeout chicken fried rice', emoji: 'ðŸš', cuisine: 'Asian',
    meal: ['dinner', 'lunch'], diets: ['dairy-free'], allergens: ['eggs', 'soy', 'gluten'],
    time: 25, servings: 2,
    ing: [
      { f: 'rice', q: 180 }, { f: 'chicken_thigh', q: 250 }, { f: 'eggs', q: 2 },
      { f: 'peas_frozen', q: 100 }, { f: 'carrots', q: 80 }, { f: 'scallions', q: 0.5 },
      { f: 'soy_sauce', q: 30 }, { f: 'ginger', q: 10 }, { f: 'garlic', q: 0.2 }, { f: 'olive_oil', q: 20 }
    ],
    steps: [
      'Cook the rice ahead if you can â€” cold, dry rice fries best.',
      'Stir-fry the diced chicken in half the oil over high heat until golden, 4â€“5 minutes; set aside.',
      'Scramble the eggs in the pan, then add the remaining oil with the diced carrot, peas, ginger and garlic; fry 2 minutes.',
      'Add the rice, pressing it into the hot pan; let it crackle 1 minute before tossing.',
      'Return the chicken, splash in the soy sauce, toss with sliced scallions and serve.'
    ],
    tip: 'High heat and a crowded-pan intolerance are the two rules of fried rice.'
  },
  {
    id: 'ginger_tofu_stirfry', name: 'Crispy ginger-garlic tofu stir-fry', emoji: 'ðŸ¥¦', cuisine: 'Asian',
    meal: ['dinner'], diets: ['vegan', 'vegetarian', 'dairy-free'], allergens: ['soy', 'gluten'],
    time: 30, servings: 2,
    ing: [
      { f: 'tofu', q: 350 }, { f: 'broccoli', q: 1 }, { f: 'bell_pepper', q: 1 },
      { f: 'soy_sauce', q: 30 }, { f: 'ginger', q: 12 }, { f: 'garlic', q: 0.3 },
      { f: 'rice', q: 160 }, { f: 'scallions', q: 0.5 }, { f: 'olive_oil', q: 20 }
    ],
    steps: [
      'Press the tofu 10 minutes between towels, then cube it. Start the rice.',
      'Sear the tofu in half the oil over medium-high, undisturbed 3 minutes a side, until deeply golden. Set aside.',
      'Stir-fry the broccoli florets and sliced pepper in the rest of the oil, 4 minutes, until crisp-tender.',
      'Add the grated ginger and minced garlic for 30 seconds, then return the tofu with the soy sauce and toss to glaze.',
      'Serve over the rice, showered with sliced scallions.'
    ],
    tip: 'A dry pan-side and patience make tofu crispy â€” poking it early makes it stick.'
  },
  {
    id: 'honey_garlic_salmon_bowl', name: 'Honey-garlic salmon rice bowl', emoji: 'ðŸ£', cuisine: 'Asian',
    meal: ['dinner'], diets: ['dairy-free', 'high-protein'], allergens: ['fish', 'soy', 'gluten'],
    time: 25, servings: 2,
    ing: [
      { f: 'salmon', q: 350 }, { f: 'honey', q: 30 }, { f: 'soy_sauce', q: 30 },
      { f: 'garlic', q: 0.3 }, { f: 'rice', q: 160 }, { f: 'broccoli', q: 1 }, { f: 'scallions', q: 0.5 }
    ],
    steps: [
      'Start the rice; steam the broccoli florets over it for the final 5 minutes.',
      'Stir the honey, soy sauce and minced garlic into a glaze.',
      'Sear the salmon skin-side down in a hot skillet, 4 minutes, then flip for 2.',
      'Pour the glaze around the fish and let it bubble and thicken 1â€“2 minutes, spooning it over.',
      'Build bowls: rice, broccoli, salmon, extra glaze, sliced scallions.'
    ],
    tip: 'Pull the salmon while its center is still deep pink â€” it finishes in the glaze.'
  },

  /* ---------- Indian ---------- */
  {
    id: 'chana_masala', name: 'Chana masala', emoji: 'ðŸ›', cuisine: 'Indian',
    meal: ['dinner', 'lunch'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], allergens: [],
    time: 35, servings: 2,
    ing: [
      { f: 'chickpeas', q: 400 }, { f: 'onion', q: 1 }, { f: 'garlic', q: 0.3 },
      { f: 'ginger', q: 12 }, { f: 'crushed_tomatoes', q: 300 }, { f: 'curry_powder', q: 10 },
      { f: 'cumin', q: 4 }, { f: 'cilantro', q: 0.3 }, { f: 'rice', q: 160 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Start the rice. Soften the diced onion in the oil over medium heat, 6â€“8 minutes, until golden at the edges.',
      'Add the minced garlic, grated ginger, curry powder and cumin; fry 1 minute until the pan smells incredible.',
      'Pour in the crushed tomatoes and simmer 5 minutes until slightly darkened.',
      'Add the drained chickpeas with a splash of water; simmer 10 minutes, mashing a few against the pot to thicken the sauce.',
      'Season, shower with chopped cilantro, and serve over the rice.'
    ],
    tip: 'The long onion sautÃ© is the flavor foundation â€” donâ€™t rush those first minutes.'
  },
  {
    id: 'coconut_chicken_curry', name: 'Coconut chicken curry', emoji: 'ðŸ¥¥', cuisine: 'Indian',
    meal: ['dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: [],
    time: 40, servings: 2,
    ing: [
      { f: 'chicken_thigh', q: 350 }, { f: 'coconut_milk', q: 200 }, { f: 'curry_powder', q: 12 },
      { f: 'onion', q: 1 }, { f: 'garlic', q: 0.3 }, { f: 'ginger', q: 12 },
      { f: 'tomato', q: 2 }, { f: 'rice', q: 160 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Start the rice. Brown the chicken pieces in the oil over medium-high, about 4 minutes; set aside.',
      'Soften the diced onion in the same pot, 5 minutes, then add garlic, ginger and curry powder for 1 minute.',
      'Add the chopped tomatoes and cook until they slump, 3 minutes.',
      'Return the chicken, pour in the coconut milk, and simmer gently 15 minutes until the sauce coats a spoon.',
      'Season and serve over rice.'
    ],
    tip: 'Thighs stay juicy through the simmer â€” this is exactly what they are for.'
  },
  {
    id: 'spinach_dal', name: 'Spinach dal', emoji: 'ðŸ¥¬', cuisine: 'Indian',
    meal: ['dinner', 'lunch'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'high-protein'], allergens: [],
    time: 40, servings: 2,
    ing: [
      { f: 'lentils_dry', q: 200 }, { f: 'spinach', q: 100 }, { f: 'onion', q: 1 },
      { f: 'garlic', q: 0.3 }, { f: 'ginger', q: 10 }, { f: 'cumin', q: 5 },
      { f: 'curry_powder', q: 8 }, { f: 'rice', q: 120 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Rinse the lentils and simmer in 3 cups of water until tender, 20â€“25 minutes, skimming any foam.',
      'Meanwhile cook the rice, and fry the diced onion in the oil until deeply golden, 8 minutes.',
      'Add the garlic, ginger, cumin and curry powder to the onions for 1 minute.',
      'Fold the spiced onions into the lentils, add the spinach, and simmer 3 minutes until wilted and thick.',
      'Season generously and serve with the rice.'
    ],
    tip: 'The fried-onion finish (tadka) is the difference between fine dal and great dal.'
  },

  /* ---------- Italian ---------- */
  {
    id: 'marinara_spaghetti', name: 'Garlic-basil marinara spaghetti', emoji: 'ðŸ', cuisine: 'Italian',
    meal: ['dinner'], diets: ['vegetarian'], allergens: ['gluten', 'dairy'],
    time: 30, servings: 2,
    ing: [
      { f: 'spaghetti', q: 200 }, { f: 'crushed_tomatoes', q: 400 }, { f: 'garlic', q: 0.4 },
      { f: 'onion', q: 0.5 }, { f: 'basil', q: 0.3 }, { f: 'olive_oil', q: 25 }, { f: 'parmesan', q: 30 }
    ],
    steps: [
      'Sizzle the sliced garlic and diced onion in the olive oil over medium-low until soft and fragrant, 5 minutes â€” no color.',
      'Add the crushed tomatoes with a pinch of salt; simmer 15 minutes until glossy.',
      'Cook the spaghetti in well-salted water to just shy of al dente; reserve a cup of pasta water.',
      'Drag the pasta into the sauce with a splash of its water and toss over heat 1 minute until the sauce clings.',
      'Tear in the basil, twirl into bowls, and finish with grated parmesan.'
    ],
    tip: 'Finishing the pasta *in* the sauce is the entire trick of Italian pasta.'
  },
  {
    id: 'chicken_pomodoro_mozzarella', name: 'Skillet chicken pomodoro with mozzarella', emoji: 'ðŸ—', cuisine: 'Italian',
    meal: ['dinner'], diets: ['high-protein'], allergens: ['gluten', 'dairy'],
    time: 35, servings: 2,
    ing: [
      { f: 'chicken_breast', q: 400 }, { f: 'crushed_tomatoes', q: 300 }, { f: 'garlic', q: 0.3 },
      { f: 'mozzarella', q: 100 }, { f: 'basil', q: 0.3 }, { f: 'spaghetti', q: 160 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Halve the chicken breasts horizontally into cutlets, season, and sear in the oil 3 minutes per side; set aside.',
      'Fry the sliced garlic in the same skillet 30 seconds, then add the crushed tomatoes and simmer 8 minutes.',
      'Meanwhile cook the spaghetti in salted water.',
      'Nestle the chicken back into the sauce, top each cutlet with mozzarella, cover 3 minutes until melted.',
      'Serve over the spaghetti with torn basil.'
    ],
    tip: 'Thin cutlets cook fast and stay tender â€” thick breasts do neither.'
  },
  {
    id: 'zucchini_parmesan_frittata', name: 'Zucchini-parmesan frittata', emoji: 'ðŸ³', cuisine: 'Italian',
    meal: ['breakfast', 'lunch'], diets: ['vegetarian', 'gluten-free', 'low-carb', 'high-protein'], allergens: ['eggs', 'dairy'],
    time: 25, servings: 2,
    ing: [
      { f: 'eggs', q: 6 }, { f: 'zucchini', q: 1 }, { f: 'parmesan', q: 40 },
      { f: 'onion', q: 0.5 }, { f: 'olive_oil', q: 15 }, { f: 'salt', q: 2 }, { f: 'black_pepper', q: 1 }
    ],
    steps: [
      'SautÃ© the thinly sliced zucchini and onion in the oil in an ovenproof skillet until soft and lightly golden, 6 minutes.',
      'Whisk the eggs with most of the parmesan, the salt and pepper.',
      'Pour the eggs over the vegetables on medium-low; cook undisturbed until the edges set, 4 minutes.',
      'Scatter the remaining parmesan on top and finish under the broiler 2â€“3 minutes until puffed and golden.',
      'Rest 2 minutes, slice into wedges, eat warm or room-temperature.'
    ],
    tip: 'A frittata is dinner insurance â€” any vegetable in the crisper works.'
  },

  /* ---------- Mediterranean ---------- */
  {
    id: 'greek_chopped_pita_plate', name: 'Greek chopped salad pita plate', emoji: 'ðŸ¥™', cuisine: 'Mediterranean',
    meal: ['lunch'], diets: ['vegetarian'], allergens: ['dairy', 'gluten', 'sesame'],
    time: 15, servings: 2,
    ing: [
      { f: 'cucumber', q: 1 }, { f: 'tomato', q: 2 }, { f: 'feta', q: 80 },
      { f: 'onion', q: 0.3 }, { f: 'oregano', q: 2 }, { f: 'olive_oil', q: 20 },
      { f: 'pita', q: 2 }, { f: 'hummus', q: 120 }, { f: 'romaine', q: 0.5 }
    ],
    steps: [
      'Chop the cucumber, tomatoes and romaine; slice the onion paper-thin.',
      'Toss the vegetables with the olive oil, oregano and a pinch of salt.',
      'Warm the pitas in a dry skillet 30 seconds per side.',
      'Swoosh the hummus across two plates, pile the salad over, and crumble the feta on top.',
      'Serve with the warm pitas for scooping.'
    ],
    tip: 'Salting the tomatoes five minutes early deepens the whole salad.'
  },
  {
    id: 'lemon_oregano_salmon', name: 'Lemon-oregano salmon over garlicky spinach', emoji: 'ðŸ‹', cuisine: 'Mediterranean',
    meal: ['dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein', 'low-carb'], allergens: ['fish'],
    time: 20, servings: 2,
    ing: [
      { f: 'salmon', q: 350 }, { f: 'lemon', q: 1 }, { f: 'olive_oil', q: 20 },
      { f: 'oregano', q: 3 }, { f: 'spinach', q: 200 }, { f: 'garlic', q: 0.2 }
    ],
    steps: [
      'Rub the salmon with half the oil, the oregano, salt and the zest of the lemon.',
      'Sear skin-side down in a hot skillet 4 minutes; flip for 2 more, then rest on a plate.',
      'In the same pan, sizzle the sliced garlic in the remaining oil for 30 seconds.',
      'Pile in the spinach and toss just until collapsed, 1 minute.',
      'Plate the spinach under the salmon and finish everything with the lemonâ€™s juice.'
    ],
    tip: 'Zest before you juice â€” it is impossible the other way around.'
  },
  {
    id: 'mediterranean_quinoa_bowl', name: 'Mediterranean chickpea-quinoa bowl', emoji: 'ðŸ«’', cuisine: 'Mediterranean',
    meal: ['lunch', 'dinner'], diets: ['vegetarian', 'gluten-free'], allergens: ['dairy', 'sesame'],
    time: 25, servings: 2,
    ing: [
      { f: 'quinoa', q: 150 }, { f: 'chickpeas', q: 250 }, { f: 'cucumber', q: 1 },
      { f: 'cherry_tomatoes', q: 0.5 }, { f: 'feta', q: 60 }, { f: 'lemon', q: 1 },
      { f: 'olive_oil', q: 20 }, { f: 'hummus', q: 80 }
    ],
    steps: [
      'Rinse the quinoa and simmer in double its volume of salted water until the germ spirals out, 15 minutes. Fluff.',
      'Crisp the drained chickpeas in a dry skillet with a pinch of salt, 5 minutes.',
      'Dice the cucumber, halve the tomatoes, and whisk the lemon juice with the olive oil.',
      'Build bowls: quinoa, chickpeas, vegetables, a swoosh of hummus.',
      'Crumble the feta over and dress with the lemon oil.'
    ],
    tip: 'Toasting cooked chickpeas gives bean-haters something to reconsider.'
  },

  /* ---------- Mexican ---------- */
  {
    id: 'salsa_chicken_tacos', name: 'Weeknight salsa-braised chicken tacos', emoji: 'ðŸŒ®', cuisine: 'Mexican',
    meal: ['dinner'], diets: ['dairy-free'], allergens: ['gluten'],
    time: 30, servings: 2,
    ing: [
      { f: 'chicken_thigh', q: 350 }, { f: 'salsa', q: 200 }, { f: 'onion', q: 0.5 },
      { f: 'tortillas', q: 6 }, { f: 'avocado', q: 1 }, { f: 'cilantro', q: 0.3 }, { f: 'lime', q: 1 }
    ],
    steps: [
      'Sear the chicken thighs in a hot skillet 3 minutes per side.',
      'Pour the salsa over with a splash of water, cover, and simmer 12 minutes until the chicken shreds easily.',
      'Shred the chicken into the sauce and let it soak up the pan juices.',
      'Char the tortillas directly over the flame or in a dry skillet, seconds per side.',
      'Fill with chicken, sliced avocado, diced raw onion, cilantro, and a squeeze of lime.'
    ],
    tip: 'A good jarred salsa is a legitimate braising liquid â€” this is the shortcut that tastes like it wasnâ€™t.'
  },
  {
    id: 'black_bean_burrito_bowls', name: 'Black bean burrito bowls', emoji: 'ðŸ¥£', cuisine: 'Mexican',
    meal: ['lunch', 'dinner'], diets: ['vegetarian', 'gluten-free'], allergens: ['dairy'],
    time: 25, servings: 2,
    ing: [
      { f: 'rice', q: 160 }, { f: 'black_beans', q: 400 }, { f: 'corn_frozen', q: 120 },
      { f: 'salsa', q: 150 }, { f: 'avocado', q: 1 }, { f: 'lime', q: 1 },
      { f: 'cilantro', q: 0.3 }, { f: 'cheddar', q: 50 }, { f: 'sour_cream', q: 60 }
    ],
    steps: [
      'Cook the rice, then fold in the lime zest and half its juice.',
      'Warm the beans with a splash of water and a pinch of cumin or salt; char the corn in a dry skillet 3 minutes.',
      'Halve and slice the avocado.',
      'Build bowls: lime rice, beans, corn, salsa.',
      'Top with cheddar, a spoon of sour cream, cilantro, avocado, and the rest of the lime.'
    ],
    tip: 'Charring frozen corn straight from the bag is a free flavor upgrade.'
  },
  {
    id: 'turkey_taco_lettuce_wraps', name: 'Turkey taco lettuce wraps', emoji: 'ðŸ¥¬', cuisine: 'Mexican',
    meal: ['dinner'], diets: ['gluten-free', 'dairy-free', 'low-carb', 'high-protein'], allergens: [],
    time: 20, servings: 2,
    ing: [
      { f: 'ground_turkey', q: 400 }, { f: 'romaine', q: 1 }, { f: 'chili_powder', q: 6 },
      { f: 'cumin', q: 4 }, { f: 'onion', q: 0.5 }, { f: 'tomato', q: 2 },
      { f: 'avocado', q: 1 }, { f: 'lime', q: 1 }, { f: 'olive_oil', q: 10 }
    ],
    steps: [
      'Brown the turkey in the oil over medium-high, breaking it up, 5 minutes.',
      'Add the diced onion, chili powder and cumin; cook 3 minutes more, then splash in water to make it saucy.',
      'Separate the romaine into cup-shaped leaves; dice the tomato and avocado.',
      'Spoon the spiced turkey into the leaves.',
      'Top with tomato and avocado and finish with lime.'
    ],
    tip: 'Double the filling and tomorrowâ€™s lunch is a taco salad.'
  },

  /* ================= BATCH 2 â€” vegan & low-carb emphasis ================= */
  {
    id: 'curried_tofu_scramble', name: 'Curried tofu scramble', emoji: 'ðŸ³', cuisine: 'American',
    meal: ['breakfast'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'high-protein'], allergens: ['soy'],
    time: 15, servings: 2,
    ing: [
      { f: 'tofu', q: 400 }, { f: 'onion', q: 0.5 }, { f: 'bell_pepper', q: 1 },
      { f: 'spinach', q: 80 }, { f: 'curry_powder', q: 4 }, { f: 'olive_oil', q: 15 }, { f: 'salt', q: 2 }
    ],
    steps: [
      'Warm the oil in a skillet over medium and soften the diced onion and pepper, 4 minutes.',
      'Crumble in the tofu with your hands â€” ragged pieces catch the seasoning best.',
      'Sprinkle over the curry powder and salt; fry 4â€“5 minutes until the tofu dries out a little and takes color.',
      'Fold in the spinach until just wilted.',
      'Taste, season harder than you think, and serve hot.'
    ],
    tip: 'Firm tofu, well crumbled, has scrambled-egg texture without trying to be eggs.'
  },
  {
    id: 'pb_banana_oatmeal', name: 'Peanut butter banana oatmeal', emoji: 'ðŸ¥œ', cuisine: 'American',
    meal: ['breakfast'], diets: ['vegan', 'vegetarian', 'dairy-free'], allergens: ['nuts'],
    time: 10, servings: 2,
    ing: [
      { f: 'oats', q: 120 }, { f: 'banana', q: 2 }, { f: 'peanut_butter', q: 40 },
      { f: 'cinnamon', q: 2 }, { f: 'honey', q: 15 }
    ],
    steps: [
      'Simmer the oats in 2 cups of water with a pinch of salt, stirring, 5 minutes.',
      'Mash one banana straight into the pot â€” it sweetens and creams the oats.',
      'Swirl in the peanut butter and cinnamon off the heat.',
      'Slice the second banana over the top.',
      'Finish with a thread of honey.'
    ],
    tip: 'Mashed banana does the work of milk and sugar in one move.'
  },
  {
    id: 'coconut_chickpea_spinach_curry', name: 'Coconut chickpea & spinach curry', emoji: 'ðŸ›', cuisine: 'Indian',
    meal: ['dinner'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], allergens: [],
    time: 30, servings: 2,
    ing: [
      { f: 'chickpeas', q: 400 }, { f: 'coconut_milk', q: 250 }, { f: 'spinach', q: 120 },
      { f: 'onion', q: 1 }, { f: 'garlic', q: 0.3 }, { f: 'ginger', q: 10 },
      { f: 'curry_powder', q: 10 }, { f: 'rice', q: 140 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Start the rice. Fry the diced onion in the oil until golden, 6 minutes.',
      'Add the garlic, ginger and curry powder; toast 1 minute.',
      'Pour in the coconut milk and drained chickpeas; simmer 10 minutes until slightly thickened.',
      'Stir in the spinach to wilt.',
      'Season and serve over the rice.'
    ],
    tip: 'Simmer coconut milk gently â€” a hard boil splits it.'
  },
  {
    id: 'lemon_lentil_soup', name: 'Lemony Mediterranean lentil soup', emoji: 'ðŸ²', cuisine: 'Mediterranean',
    meal: ['lunch', 'dinner'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'high-protein'], allergens: [],
    time: 40, servings: 2,
    ing: [
      { f: 'lentils_dry', q: 200 }, { f: 'carrots', q: 120 }, { f: 'celery', q: 0.3 },
      { f: 'onion', q: 1 }, { f: 'garlic', q: 0.3 }, { f: 'cumin', q: 4 },
      { f: 'lemon', q: 1 }, { f: 'olive_oil', q: 20 }
    ],
    steps: [
      'Soften the diced onion, carrot and celery in the oil over medium, 6 minutes.',
      'Add the garlic and cumin for 1 minute.',
      'Add the rinsed lentils and 4 cups of water; simmer 25 minutes until tender.',
      'Blend half the pot (or mash roughly) for body, leaving the rest chunky.',
      'Finish with the lemonâ€™s juice and a swirl of olive oil â€” the lemon is not optional.'
    ],
    tip: 'Acid at the end is what separates restaurant lentil soup from sad lentil soup.'
  },
  {
    id: 'sweet_potato_black_bean_tacos', name: 'Roasted sweet potato & black bean tacos', emoji: 'ðŸŒ®', cuisine: 'Mexican',
    meal: ['dinner'], diets: ['vegan', 'vegetarian', 'dairy-free'], allergens: ['gluten'],
    time: 35, servings: 2,
    ing: [
      { f: 'sweet_potatoes', q: 450 }, { f: 'black_beans', q: 300 }, { f: 'tortillas', q: 6 },
      { f: 'chili_powder', q: 6 }, { f: 'cumin', q: 3 }, { f: 'avocado', q: 1 },
      { f: 'lime', q: 1 }, { f: 'cilantro', q: 0.3 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Heat the oven to 425Â°F. Toss the diced sweet potatoes with oil, chili powder and cumin; roast 25 minutes until browned at the edges.',
      'Warm the beans with a splash of water and a pinch of salt.',
      'Mash the avocado with the limeâ€™s juice.',
      'Char the tortillas in a dry skillet.',
      'Build: avocado smear, beans, sweet potatoes, cilantro.'
    ],
    tip: 'Sweet + smoky + creamy is why nobody misses the meat here.'
  },
  {
    id: 'quinoa_stuffed_peppers', name: 'Quinoa-stuffed bell peppers', emoji: 'ðŸ«‘', cuisine: 'American',
    meal: ['dinner'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], allergens: [],
    time: 45, servings: 2,
    ing: [
      { f: 'bell_pepper', q: 3 }, { f: 'quinoa', q: 130 }, { f: 'black_beans', q: 250 },
      { f: 'corn_frozen', q: 100 }, { f: 'crushed_tomatoes', q: 200 }, { f: 'cumin', q: 4 },
      { f: 'onion', q: 0.5 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Cook the quinoa. Heat the oven to 400Â°F.',
      'SautÃ© the diced onion in oil, then stir in beans, corn, crushed tomatoes, cumin and the cooked quinoa; simmer 3 minutes.',
      'Halve the peppers through the stem and seed them.',
      'Pack the filling into the pepper halves, add a splash of water to the dish, cover with foil.',
      'Bake 25 minutes covered, then 5 uncovered until the peppers are tender but standing.'
    ],
    tip: 'Halved peppers cook faster and hold more filling than the upright classic.'
  },
  {
    id: 'hummus_veggie_pita_pockets', name: 'Hummus & crunch pita pockets', emoji: 'ðŸ¥™', cuisine: 'Mediterranean',
    meal: ['lunch'], diets: ['vegan', 'vegetarian', 'dairy-free'], allergens: ['gluten', 'sesame'],
    time: 10, servings: 2,
    ing: [
      { f: 'pita', q: 2 }, { f: 'hummus', q: 160 }, { f: 'cucumber', q: 1 },
      { f: 'tomato', q: 1 }, { f: 'romaine', q: 0.5 }, { f: 'lemon', q: 0.5 }, { f: 'olive_oil', q: 10 }
    ],
    steps: [
      'Halve the pitas and open the pockets.',
      'Slice the cucumber and tomato thin; shred the romaine.',
      'Toss the vegetables with lemon juice, olive oil and a pinch of salt.',
      'Spread hummus generously inside each pocket.',
      'Stuff with the dressed crunch and eat immediately.'
    ],
    tip: 'Dress the vegetables, not the bread â€” soggy pita is a preventable tragedy.'
  },
  {
    id: 'vegetable_fried_rice', name: 'Ginger vegetable fried rice', emoji: 'ðŸš', cuisine: 'Asian',
    meal: ['dinner', 'lunch'], diets: ['vegan', 'vegetarian', 'dairy-free'], allergens: ['soy', 'gluten'],
    time: 20, servings: 2,
    ing: [
      { f: 'rice', q: 180 }, { f: 'carrots', q: 100 }, { f: 'peas_frozen', q: 100 },
      { f: 'corn_frozen', q: 80 }, { f: 'scallions', q: 0.5 }, { f: 'ginger', q: 12 },
      { f: 'garlic', q: 0.3 }, { f: 'soy_sauce', q: 30 }, { f: 'olive_oil', q: 20 }
    ],
    steps: [
      'Use cold cooked rice if you have it; fresh rice should cool spread on a plate 10 minutes.',
      'Stir-fry the diced carrots in the oil over high heat, 3 minutes.',
      'Add peas, corn, ginger and garlic; fry 2 minutes more.',
      'Add the rice, press flat, and let it sizzle untouched 1 minute before tossing.',
      'Season with soy sauce, toss with scallions, serve hot.'
    ],
    tip: 'The untouched minute is where fried rice gets its toasty edges.'
  },
  {
    id: 'coconut_lentil_soup', name: 'Coconut red-spiced lentil soup', emoji: 'ðŸ¥¥', cuisine: 'Indian',
    meal: ['dinner', 'lunch'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'high-protein'], allergens: [],
    time: 35, servings: 2,
    ing: [
      { f: 'lentils_dry', q: 200 }, { f: 'coconut_milk', q: 200 }, { f: 'crushed_tomatoes', q: 200 },
      { f: 'onion', q: 1 }, { f: 'garlic', q: 0.3 }, { f: 'ginger', q: 10 },
      { f: 'curry_powder', q: 10 }, { f: 'olive_oil', q: 15 }, { f: 'lime', q: 1 }
    ],
    steps: [
      'Soften the diced onion in the oil, 5 minutes; add garlic, ginger and curry powder for 1 minute.',
      'Add the rinsed lentils, crushed tomatoes and 3 cups of water.',
      'Simmer 20â€“25 minutes until the lentils collapse into the broth.',
      'Stir in the coconut milk and warm through without boiling.',
      'Brighten with lime juice and serve.'
    ],
    tip: 'Lentils + coconut is the highest comfort-per-dollar ratio in the kitchen.'
  },
  {
    id: 'smashed_chickpea_avocado_toast', name: 'Smashed chickpea avocado toast', emoji: 'ðŸ¥‘', cuisine: 'American',
    meal: ['breakfast', 'lunch'], diets: ['vegan', 'vegetarian', 'dairy-free'], allergens: ['gluten'],
    time: 10, servings: 2,
    ing: [
      { f: 'bread', q: 4 }, { f: 'chickpeas', q: 250 }, { f: 'avocado', q: 1 },
      { f: 'lemon', q: 0.5 }, { f: 'olive_oil', q: 10 }, { f: 'black_pepper', q: 1 }, { f: 'salt', q: 2 }
    ],
    steps: [
      'Toast the bread properly â€” deep golden, not beige.',
      'Fork-smash the drained chickpeas with the avocado, lemon juice, salt and pepper. Leave it chunky.',
      'Pile onto the toast.',
      'Finish with olive oil and more pepper.',
      'Eat over a plate; this is structural-integrity-optional food.'
    ],
    tip: 'Chickpeas double the protein and make avocado toast an actual meal.'
  },
  {
    id: 'peanut_tofu_rice_bowl', name: 'Peanut-sauce tofu rice bowl', emoji: 'ðŸ¥£', cuisine: 'Asian',
    meal: ['dinner'], diets: ['vegan', 'vegetarian', 'dairy-free'], allergens: ['soy', 'nuts', 'gluten'],
    time: 30, servings: 2,
    ing: [
      { f: 'tofu', q: 350 }, { f: 'peanut_butter', q: 50 }, { f: 'soy_sauce', q: 25 },
      { f: 'lime', q: 1 }, { f: 'honey', q: 15 }, { f: 'garlic', q: 0.2 },
      { f: 'rice', q: 160 }, { f: 'carrots', q: 100 }, { f: 'cucumber', q: 0.5 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Start the rice. Press and cube the tofu, then sear in the oil until golden on two sides, 8 minutes total.',
      'Whisk the peanut butter with soy sauce, lime juice, honey, grated garlic and 3â€“4 tablespoons of hot water into a pourable sauce.',
      'Ribbon the carrots with a peeler; slice the cucumber.',
      'Toss the hot tofu in half the sauce to glaze.',
      'Bowl the rice, tofu and vegetables; drizzle the rest of the sauce over.'
    ],
    tip: 'Hot water is the secret to a silky peanut sauce that doesnâ€™t seize.'
  },
  {
    id: 'zucchini_tomato_ratatouille', name: 'Weeknight ratatouille skillet', emoji: 'ðŸ…', cuisine: 'Mediterranean',
    meal: ['dinner'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'low-carb'], allergens: [],
    time: 35, servings: 2,
    ing: [
      { f: 'zucchini', q: 2 }, { f: 'bell_pepper', q: 1 }, { f: 'onion', q: 1 },
      { f: 'crushed_tomatoes', q: 400 }, { f: 'garlic', q: 0.3 }, { f: 'oregano', q: 3 },
      { f: 'basil', q: 0.3 }, { f: 'olive_oil', q: 25 }
    ],
    steps: [
      'Brown the sliced zucchini hard in half the oil over medium-high, 5 minutes; set aside.',
      'Soften the sliced onion and pepper in the rest of the oil, 5 minutes.',
      'Add the garlic and oregano, then the crushed tomatoes; simmer 10 minutes.',
      'Return the zucchini and simmer 5 more, until everything is silky but not mush.',
      'Tear in the basil and serve â€” alone, over rice, or under a fried egg.'
    ],
    tip: 'Browning the zucchini separately keeps it from watering down the stew.'
  },
  {
    id: 'mexican_rice_bean_skillet', name: 'One-pan Mexican rice & beans', emoji: 'ðŸ³', cuisine: 'Mexican',
    meal: ['dinner'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], allergens: [],
    time: 30, servings: 2,
    ing: [
      { f: 'rice', q: 160 }, { f: 'black_beans', q: 300 }, { f: 'salsa', q: 200 },
      { f: 'corn_frozen', q: 100 }, { f: 'onion', q: 0.5 }, { f: 'cumin', q: 4 },
      { f: 'lime', q: 1 }, { f: 'cilantro', q: 0.3 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Soften the diced onion in the oil with the cumin, 3 minutes.',
      'Stir in the rice to coat, then add the salsa and 1Â½ cups of water.',
      'Cover and simmer low 15 minutes.',
      'Scatter the beans and corn on top, cover again 5 minutes until the rice is tender.',
      'Fluff, fold everything together, finish with lime and cilantro.'
    ],
    tip: 'The salsa is doing the work of six ingredients â€” buy one you would eat with a spoon.'
  },
  {
    id: 'mushroom_quinoa_pilaf', name: 'Mushroom & spinach quinoa pilaf', emoji: 'ðŸ„', cuisine: 'Mediterranean',
    meal: ['dinner', 'lunch'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], allergens: [],
    time: 30, servings: 2,
    ing: [
      { f: 'quinoa', q: 150 }, { f: 'mushrooms', q: 250 }, { f: 'spinach', q: 100 },
      { f: 'onion', q: 0.5 }, { f: 'garlic', q: 0.3 }, { f: 'olive_oil', q: 20 }, { f: 'lemon', q: 0.5 }
    ],
    steps: [
      'Cook the quinoa in salted water, 15 minutes, and fluff.',
      'Meanwhile brown the sliced mushrooms in the oil over medium-high â€” crowd them less than feels natural â€” 6 minutes.',
      'Add the diced onion and garlic; soften 3 minutes.',
      'Fold in the spinach to wilt, then the quinoa.',
      'Season and finish with lemon juice.'
    ],
    tip: 'Mushrooms brown only after their water burns off â€” patience, then flavor.'
  },
  {
    id: 'sweet_potato_chili', name: 'Smoky sweet potato & bean chili', emoji: 'ðŸ ', cuisine: 'American',
    meal: ['dinner'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], allergens: [],
    time: 40, servings: 4,
    ing: [
      { f: 'sweet_potatoes', q: 500 }, { f: 'black_beans', q: 400 }, { f: 'crushed_tomatoes', q: 400 },
      { f: 'onion', q: 1 }, { f: 'garlic', q: 0.3 }, { f: 'chili_powder', q: 10 },
      { f: 'cumin', q: 5 }, { f: 'corn_frozen', q: 100 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Soften the diced onion in the oil, 4 minutes; add garlic and the spices for 1 minute.',
      'Add the diced sweet potatoes, crushed tomatoes and 2 cups of water.',
      'Simmer 20 minutes until the sweet potato is fork-tender.',
      'Add the beans and corn; simmer 5 more minutes.',
      'Mash a few sweet potato chunks against the pot to thicken, season, serve.'
    ],
    tip: 'Sweet potato rounds out chili heat the way sugar never quite does.'
  },
  {
    id: 'apple_cinnamon_oatmeal', name: 'Apple pie oatmeal', emoji: 'ðŸŽ', cuisine: 'American',
    meal: ['breakfast'], diets: ['vegan', 'vegetarian', 'dairy-free'], allergens: [],
    time: 15, servings: 2,
    ing: [
      { f: 'oats', q: 120 }, { f: 'apple', q: 2 }, { f: 'cinnamon', q: 3 },
      { f: 'honey', q: 20 }, { f: 'almonds', q: 30 }
    ],
    steps: [
      'Dice one apple and simmer it in 2 cups of water with the cinnamon, 3 minutes.',
      'Add the oats and a pinch of salt; simmer 5 minutes, stirring.',
      'Grate the second apple straight into the pot and stir through.',
      'Sweeten with honey to taste.',
      'Top with roughly chopped almonds for crunch.'
    ],
    tip: 'Grated apple melts into the oats; diced apple stays tender-crisp â€” using both is the trick.'
  },
  {
    id: 'crispy_chickpea_greek_salad', name: 'Crispy chickpea Greek salad', emoji: 'ðŸ¥—', cuisine: 'Mediterranean',
    meal: ['lunch'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], allergens: [],
    time: 20, servings: 2,
    ing: [
      { f: 'chickpeas', q: 400 }, { f: 'romaine', q: 1 }, { f: 'cucumber', q: 1 },
      { f: 'cherry_tomatoes', q: 0.5 }, { f: 'onion', q: 0.3 }, { f: 'oregano', q: 3 },
      { f: 'lemon', q: 1 }, { f: 'olive_oil', q: 25 }
    ],
    steps: [
      'Dry the chickpeas well, then crisp them in half the oil in a skillet with the oregano and a pinch of salt, 8â€“10 minutes.',
      'Chop the romaine, cucumber and halve the tomatoes; shave the onion thin.',
      'Whisk the lemon juice with the remaining oil.',
      'Toss the vegetables with the dressing.',
      'Top with the hot, crackly chickpeas and eat while they still crunch.'
    ],
    tip: 'Hot-on-cold is the move â€” warm chickpeas soften the onionâ€™s bite.'
  },
  {
    id: 'coconut_sweet_potato_soup', name: 'Coconut-ginger sweet potato soup', emoji: 'ðŸœ', cuisine: 'Asian',
    meal: ['dinner', 'lunch'], diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], allergens: [],
    time: 35, servings: 2,
    ing: [
      { f: 'sweet_potatoes', q: 500 }, { f: 'coconut_milk', q: 250 }, { f: 'ginger', q: 15 },
      { f: 'onion', q: 1 }, { f: 'garlic', q: 0.3 }, { f: 'lime', q: 1 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Soften the diced onion in the oil, 5 minutes; add the garlic and grated ginger for 1 minute.',
      'Add the peeled, cubed sweet potatoes and 2Â½ cups of water; simmer 18 minutes until completely tender.',
      'Blend smooth (an immersion blender straight in the pot is easiest).',
      'Stir in the coconut milk and reheat gently.',
      'Season and finish each bowl with a hard squeeze of lime.'
    ],
    tip: 'Ginger and lime keep a sweet soup savory â€” donâ€™t skimp on either.'
  },
  {
    id: 'garlic_butter_shrimp_zucchini', name: 'Garlic-butter shrimp & zucchini', emoji: 'ðŸ¤', cuisine: 'American',
    meal: ['dinner'], diets: ['gluten-free', 'low-carb', 'high-protein'], allergens: ['shellfish', 'dairy'],
    time: 15, servings: 2,
    ing: [
      { f: 'shrimp', q: 400 }, { f: 'zucchini', q: 2 }, { f: 'butter', q: 30 },
      { f: 'garlic', q: 0.4 }, { f: 'lemon', q: 1 }, { f: 'black_pepper', q: 1 }, { f: 'salt', q: 2 }
    ],
    steps: [
      'Halve the zucchini lengthwise and slice into half-moons; pat the shrimp very dry.',
      'Brown the zucchini in half the butter over medium-high, 4 minutes; push to the side.',
      'Add the rest of the butter and the shrimp in one layer; cook 90 seconds per side.',
      'Add the sliced garlic for the final minute â€” it should sizzle, not scorch.',
      'Kill the heat, season, and finish with lemon juice, scraping up the pan butter.'
    ],
    tip: 'Shrimp are done the instant they curl into loose Cs â€” tight Os are overcooked.'
  },
  {
    id: 'lemon_pepper_chicken_broccoli', name: 'Lemon-pepper chicken & charred broccoli', emoji: 'ðŸ‹', cuisine: 'American',
    meal: ['dinner'], diets: ['gluten-free', 'dairy-free', 'low-carb', 'high-protein'], allergens: [],
    time: 25, servings: 2,
    ing: [
      { f: 'chicken_breast', q: 400 }, { f: 'broccoli', q: 1 }, { f: 'lemon', q: 1 },
      { f: 'black_pepper', q: 3 }, { f: 'garlic', q: 0.2 }, { f: 'olive_oil', q: 25 }, { f: 'salt', q: 3 }
    ],
    steps: [
      'Slice the chicken into cutlets; rub with half the oil, the lemon zest, plenty of black pepper and salt.',
      'Sear over medium-high, 3â€“4 minutes per side, until cooked through; rest.',
      'Char the broccoli florets in the remaining oil in the same hot pan, 5 minutes, adding the sliced garlic at the end.',
      'Splash in 2 tablespoons of water and cover 1 minute to steam-finish.',
      'Serve everything doused with the lemonâ€™s juice.'
    ],
    tip: 'Zest in the rub, juice at the end â€” lemon twice, two different jobs.'
  },
  {
    id: 'burger_bowls', name: 'Loaded burger bowls', emoji: 'ðŸ”', cuisine: 'American',
    meal: ['dinner'], diets: ['gluten-free', 'low-carb', 'high-protein'], allergens: ['dairy'],
    time: 20, servings: 2,
    ing: [
      { f: 'ground_beef', q: 400 }, { f: 'romaine', q: 1 }, { f: 'tomato', q: 1 },
      { f: 'onion', q: 0.3 }, { f: 'cheddar', q: 60 }, { f: 'avocado', q: 1 },
      { f: 'sour_cream', q: 40 }, { f: 'olive_oil', q: 10 }
    ],
    steps: [
      'Season the beef and brown it in the oil in crumbles, undisturbed at first for crust, 6â€“7 minutes.',
      'Melt the cheddar over the beef in the pan.',
      'Chop the romaine, dice the tomato, shave the onion, slice the avocado.',
      'Build bowls on the lettuce with the cheesy beef and vegetables.',
      'Thin the sour cream with a splash of water and drizzle over as the â€œspecial sauce.â€'
    ],
    tip: 'Everything you like about a burger, minus the part that was mostly filler anyway.'
  },
  {
    id: 'salmon_avocado_salad', name: 'Seared salmon & avocado salad', emoji: 'ðŸŸ', cuisine: 'American',
    meal: ['lunch', 'dinner'], diets: ['gluten-free', 'dairy-free', 'low-carb', 'high-protein'], allergens: ['fish'],
    time: 20, servings: 2,
    ing: [
      { f: 'salmon', q: 350 }, { f: 'romaine', q: 1 }, { f: 'avocado', q: 1 },
      { f: 'cucumber', q: 0.5 }, { f: 'lemon', q: 1 }, { f: 'olive_oil', q: 20 }
    ],
    steps: [
      'Season the salmon and sear skin-side down 4 minutes, flip for 2, then rest.',
      'Chop the romaine and cucumber; slice the avocado.',
      'Whisk the lemon juice into the olive oil with salt and pepper.',
      'Toss the greens in most of the dressing.',
      'Flake the warm salmon over the top and spoon on the rest of the dressing.'
    ],
    tip: 'Warm fish on cold crisp greens is a temperature trick worth stealing.'
  },
  {
    id: 'ginger_shrimp_stirfry', name: 'Ginger-garlic shrimp stir-fry', emoji: 'ðŸ¦', cuisine: 'Asian',
    meal: ['dinner'], diets: ['dairy-free', 'low-carb', 'high-protein'], allergens: ['shellfish', 'soy', 'gluten'],
    time: 15, servings: 2,
    ing: [
      { f: 'shrimp', q: 400 }, { f: 'broccoli', q: 1 }, { f: 'bell_pepper', q: 1 },
      { f: 'ginger', q: 15 }, { f: 'garlic', q: 0.3 }, { f: 'soy_sauce', q: 25 },
      { f: 'scallions', q: 0.5 }, { f: 'olive_oil', q: 20 }
    ],
    steps: [
      'Get the pan properly hot. Stir-fry the broccoli florets and sliced pepper in half the oil, 4 minutes; set aside.',
      'Add the rest of the oil and the dried shrimp in one layer; 90 seconds per side.',
      'Add the ginger and garlic for 30 seconds.',
      'Return the vegetables with the soy sauce and toss hard for 1 minute.',
      'Finish with sliced scallions.'
    ],
    tip: 'Stir-fry is 80% prep, 20% cooking â€” everything cut and within reach before the flame.'
  },
  {
    id: 'chicken_parm_salad', name: 'Grilled chicken & parmesan romaine salad', emoji: 'ðŸ¥¬', cuisine: 'Italian',
    meal: ['lunch', 'dinner'], diets: ['gluten-free', 'low-carb', 'high-protein'], allergens: ['dairy'],
    time: 20, servings: 2,
    ing: [
      { f: 'chicken_breast', q: 350 }, { f: 'romaine', q: 1 }, { f: 'parmesan', q: 40 },
      { f: 'lemon', q: 1 }, { f: 'olive_oil', q: 25 }, { f: 'garlic', q: 0.1 }, { f: 'black_pepper', q: 2 }
    ],
    steps: [
      'Pound the chicken even, season, and grill or sear 4 minutes per side; rest and slice.',
      'Whisk the lemon juice, grated garlic and plenty of black pepper into the olive oil.',
      'Chop the romaine into wide ribbons.',
      'Toss the leaves with the dressing and most of the parmesan.',
      'Top with the sliced chicken and the rest of the cheese.'
    ],
    tip: 'Lemon + parmesan + pepper gets you 90% of a Caesar with zero raw-egg logistics.'
  },
  {
    id: 'taco_stuffed_avocados', name: 'Taco-stuffed avocados', emoji: 'ðŸ¥‘', cuisine: 'Mexican',
    meal: ['dinner', 'lunch'], diets: ['gluten-free', 'dairy-free', 'low-carb', 'high-protein'], allergens: [],
    time: 20, servings: 2,
    ing: [
      { f: 'ground_turkey', q: 350 }, { f: 'avocado', q: 2 }, { f: 'chili_powder', q: 6 },
      { f: 'cumin', q: 3 }, { f: 'salsa', q: 120 }, { f: 'cilantro', q: 0.2 },
      { f: 'lime', q: 1 }, { f: 'olive_oil', q: 10 }
    ],
    steps: [
      'Brown the turkey in the oil with the chili powder and cumin, 6â€“7 minutes.',
      'Stir in half the salsa and simmer 2 minutes until saucy.',
      'Halve and pit the avocados; scoop a little extra from each half to widen the bowl (eat the scoops â€” chefâ€™s tax).',
      'Pile the taco meat into the avocado halves.',
      'Top with the remaining salsa, cilantro and lime.'
    ],
    tip: 'The avocado IS the tortilla. No notes.'
  },
  {
    id: 'egg_muffin_cups', name: 'Meal-prep egg muffin cups', emoji: 'ðŸ§', cuisine: 'American',
    meal: ['breakfast'], diets: ['vegetarian', 'gluten-free', 'low-carb', 'high-protein'], allergens: ['eggs', 'dairy'],
    time: 30, servings: 2,
    ing: [
      { f: 'eggs', q: 8 }, { f: 'bell_pepper', q: 1 }, { f: 'spinach', q: 60 },
      { f: 'cheddar', q: 60 }, { f: 'scallions', q: 0.3 }, { f: 'olive_oil', q: 10 },
      { f: 'salt', q: 2 }, { f: 'black_pepper', q: 1 }
    ],
    steps: [
      'Heat the oven to 375Â°F and oil a muffin tin well.',
      'Whisk the eggs with salt and pepper.',
      'Divide the diced pepper, chopped spinach, scallions and cheddar among 8â€“10 cups.',
      'Pour the egg over, filling each cup three-quarters.',
      'Bake 18â€“20 minutes until puffed and set. They keep 4 days refrigerated.'
    ],
    tip: 'They deflate as they cool â€” thatâ€™s physics, not failure.'
  },

  /* ================= BATCH 2b â€” comfort & family dinners ================= */
  {
    id: 'chicken_burrito_bowl', name: 'Chipotle-style chicken burrito bowl', emoji: 'ðŸ—', cuisine: 'Mexican',
    meal: ['dinner', 'lunch'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: [],
    time: 30, servings: 2,
    ing: [
      { f: 'chicken_thigh', q: 350 }, { f: 'rice', q: 160 }, { f: 'black_beans', q: 250 },
      { f: 'salsa', q: 150 }, { f: 'lime', q: 1 }, { f: 'cilantro', q: 0.3 },
      { f: 'chili_powder', q: 6 }, { f: 'cumin', q: 3 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Cook the rice; fold in lime zest and half the juice with the chopped cilantro stems.',
      'Rub the chicken with chili powder, cumin and salt; sear in the oil 4â€“5 minutes per side, rest, slice.',
      'Warm the beans with a splash of their liquid.',
      'Build bowls: cilantro-lime rice, beans, chicken.',
      'Top with salsa, cilantro leaves, and the last of the lime.'
    ],
    tip: 'Thighs forgive the extra minute that breasts punish.'
  },
  {
    id: 'beef_broccoli_rice', name: 'Takeout-style beef & broccoli', emoji: 'ðŸ¥¡', cuisine: 'Asian',
    meal: ['dinner'], diets: ['dairy-free', 'high-protein'], allergens: ['soy', 'gluten'],
    time: 25, servings: 2,
    ing: [
      { f: 'ground_beef', q: 400 }, { f: 'broccoli', q: 1 }, { f: 'soy_sauce', q: 35 },
      { f: 'honey', q: 15 }, { f: 'garlic', q: 0.3 }, { f: 'ginger', q: 10 },
      { f: 'rice', q: 160 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Start the rice. Stir the soy sauce, honey, and 3 tablespoons of water into a sauce.',
      'Brown the beef hard in the oil, breaking it into large crumbles, 5 minutes; push aside.',
      'Add the broccoli florets with a splash of water; cover 2 minutes to steam.',
      'Add the garlic and ginger, then the sauce; toss everything 2 minutes until glossy.',
      'Serve over the rice.'
    ],
    tip: 'Ground beef gives you all the flavor of the takeout classic in a third of the time and cost.'
  },
  {
    id: 'turkey_meatballs_marinara', name: 'Turkey meatballs in marinara', emoji: 'ðŸ§†', cuisine: 'Italian',
    meal: ['dinner'], diets: ['dairy-free', 'high-protein'], allergens: ['gluten', 'eggs'],
    time: 40, servings: 2,
    ing: [
      { f: 'ground_turkey', q: 450 }, { f: 'oats', q: 40 }, { f: 'eggs', q: 1 },
      { f: 'garlic', q: 0.3 }, { f: 'crushed_tomatoes', q: 400 }, { f: 'basil', q: 0.3 },
      { f: 'spaghetti', q: 160 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Blitz the oats to a rough flour. Mix with the turkey, egg, half the minced garlic and a big pinch of salt; roll into 12 meatballs.',
      'Brown the meatballs in the oil on two sides, 5 minutes total â€” they finish in the sauce.',
      'Add the rest of the garlic, then the crushed tomatoes; simmer 15 minutes, turning the meatballs once.',
      'Cook the spaghetti meanwhile in salted water.',
      'Toss pasta with sauce, top with meatballs and torn basil.'
    ],
    tip: 'Oats disappear as a binder and keep lean turkey juicy â€” nobody will guess.'
  },
  {
    id: 'salmon_quinoa_power_bowl', name: 'Salmon quinoa power bowl', emoji: 'ðŸ’ª', cuisine: 'American',
    meal: ['lunch', 'dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: ['fish'],
    time: 25, servings: 2,
    ing: [
      { f: 'salmon', q: 300 }, { f: 'quinoa', q: 140 }, { f: 'spinach', q: 80 },
      { f: 'avocado', q: 1 }, { f: 'cucumber', q: 0.5 }, { f: 'lemon', q: 1 }, { f: 'olive_oil', q: 20 }
    ],
    steps: [
      'Cook the quinoa; fluff and season while warm.',
      'Sear the seasoned salmon 4 minutes skin-side, 2 on the flesh; rest and flake.',
      'Wilt the spinach into the warm quinoa â€” residual heat does it.',
      'Slice the avocado and cucumber.',
      'Bowl everything and dress with lemon juice whisked into the olive oil.'
    ],
    tip: 'Seasoning grains while warm means half the dressing does twice the work.'
  },
  {
    id: 'chicken_tortilla_soup', name: 'Chicken tortilla soup', emoji: 'ðŸ²', cuisine: 'Mexican',
    meal: ['dinner'], diets: ['dairy-free', 'high-protein'], allergens: ['gluten'],
    time: 35, servings: 2,
    ing: [
      { f: 'chicken_breast', q: 300 }, { f: 'broth', q: 750 }, { f: 'salsa', q: 200 },
      { f: 'corn_frozen', q: 100 }, { f: 'tortillas', q: 3 }, { f: 'lime', q: 1 },
      { f: 'cilantro', q: 0.3 }, { f: 'cumin', q: 4 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Cut two tortillas into strips, toss with a little oil, and crisp in a skillet or 400Â°F oven, 8 minutes.',
      'Simmer the chicken in the broth with the salsa, cumin and the third tortilla torn in (it melts and thickens), 15 minutes.',
      'Shred the chicken back into the pot with the corn; simmer 3 minutes.',
      'Season and hit hard with lime.',
      'Serve topped with cilantro and the crispy strips.'
    ],
    tip: 'The dissolved tortilla is the traditional thickener â€” no cream, no flour.'
  },
  {
    id: 'caprese_pasta', name: 'Warm caprese pasta', emoji: 'ðŸ…', cuisine: 'Italian',
    meal: ['dinner', 'lunch'], diets: ['vegetarian'], allergens: ['gluten', 'dairy'],
    time: 20, servings: 2,
    ing: [
      { f: 'spaghetti', q: 200 }, { f: 'cherry_tomatoes', q: 1 }, { f: 'mozzarella', q: 120 },
      { f: 'basil', q: 0.4 }, { f: 'garlic', q: 0.2 }, { f: 'olive_oil', q: 25 }
    ],
    steps: [
      'Cook the pasta in aggressively salted water.',
      'Meanwhile, halve the tomatoes and warm them in the oil with the sliced garlic over medium until they just slump, 4 minutes.',
      'Drag the pasta into the tomatoes with a splash of pasta water; toss 1 minute.',
      'Off heat, fold in the torn mozzarella so it goes creamy at the edges but keeps its shape.',
      'Shower with basil, salt, and a final thread of oil.'
    ],
    tip: 'Off-heat mozzarella is the difference between creamy and squeaky.'
  },
  {
    id: 'spinach_mushroom_quesadillas', name: 'Spinach-mushroom quesadillas', emoji: 'ðŸ«“', cuisine: 'Mexican',
    meal: ['lunch', 'dinner'], diets: ['vegetarian'], allergens: ['gluten', 'dairy'],
    time: 20, servings: 2,
    ing: [
      { f: 'tortillas', q: 4 }, { f: 'cheddar', q: 120 }, { f: 'mushrooms', q: 200 },
      { f: 'spinach', q: 80 }, { f: 'onion', q: 0.5 }, { f: 'olive_oil', q: 15 }, { f: 'salsa', q: 100 }
    ],
    steps: [
      'Brown the sliced mushrooms and onion in the oil until dry and golden, 6 minutes; wilt in the spinach and season.',
      'Layer cheddar, the vegetables, and more cheddar over half of each tortilla; fold.',
      'Toast in a dry skillet over medium, 2â€“3 minutes per side, pressing gently.',
      'Rest one minute â€” molten cheese needs to set from lava to fudge.',
      'Cut into wedges and serve with salsa.'
    ],
    tip: 'Cheese on both sides of the filling is the glue that keeps quesadillas together.'
  },
  {
    id: 'tomato_soup_grilled_cheese', name: 'Tomato-basil soup & grilled cheese', emoji: 'ðŸ¥ª', cuisine: 'American',
    meal: ['dinner', 'lunch'], diets: ['vegetarian'], allergens: ['gluten', 'dairy'],
    time: 30, servings: 2,
    ing: [
      { f: 'crushed_tomatoes', q: 500 }, { f: 'broth', q: 250 }, { f: 'onion', q: 0.5 },
      { f: 'garlic', q: 0.2 }, { f: 'basil', q: 0.3 }, { f: 'bread', q: 4 },
      { f: 'cheddar', q: 100 }, { f: 'butter', q: 20 }, { f: 'olive_oil', q: 10 }
    ],
    steps: [
      'Soften the diced onion in the olive oil, add the garlic, then the crushed tomatoes and broth; simmer 15 minutes.',
      'Blend smooth with most of the basil.',
      'Butter the bread on the outside, cheddar inside; toast in a skillet over medium-low, 3â€“4 minutes per side, lid on for the first flip.',
      'Rest the sandwiches a minute, then halve on the diagonal (mandatory).',
      'Serve with the soup for dunking.'
    ],
    tip: 'Low and slow gets the cheese melted before the bread burns â€” the lid is the cheat code.'
  },
  {
    id: 'loaded_baked_sweet_potatoes', name: 'Loaded baked sweet potatoes', emoji: 'ðŸ ', cuisine: 'American',
    meal: ['dinner'], diets: ['vegetarian', 'gluten-free'], allergens: ['dairy'],
    time: 50, servings: 2,
    ing: [
      { f: 'sweet_potatoes', q: 600 }, { f: 'black_beans', q: 250 }, { f: 'greek_yogurt', q: 100 },
      { f: 'cheddar', q: 60 }, { f: 'scallions', q: 0.5 }, { f: 'chili_powder', q: 4 }, { f: 'lime', q: 0.5 }
    ],
    steps: [
      'Bake the sweet potatoes at 425Â°F until a knife slides through, 40â€“45 minutes (or microwave 8, then oven 10 for real skin).',
      'Warm the beans with the chili powder and a splash of water.',
      'Split the potatoes and fluff the insides with a fork and a pinch of salt.',
      'Load with beans and cheddar so it melts into the flesh.',
      'Top with lime-spiked yogurt and sliced scallions.'
    ],
    tip: 'Greek yogurt out-sours sour cream and smuggles in protein.'
  },
  {
    id: 'pita_margherita_pizzas', name: 'Pita margherita pizzas', emoji: 'ðŸ•', cuisine: 'Italian',
    meal: ['dinner', 'lunch'], diets: ['vegetarian'], allergens: ['gluten', 'dairy'],
    time: 15, servings: 2,
    ing: [
      { f: 'pita', q: 3 }, { f: 'crushed_tomatoes', q: 150 }, { f: 'mozzarella', q: 150 },
      { f: 'basil', q: 0.3 }, { f: 'oregano', q: 2 }, { f: 'olive_oil', q: 15 }, { f: 'garlic', q: 0.1 }
    ],
    steps: [
      'Heat the oven to 475Â°F with a baking sheet inside.',
      'Stir the grated garlic and oregano into the crushed tomatoes with a pinch of salt.',
      'Sauce the pitas edge to edge, then tear the mozzarella over.',
      'Slide onto the hot sheet and bake 7â€“8 minutes until blistered.',
      'Basil and olive oil the moment they come out.'
    ],
    tip: 'The preheated sheet is your pizza stone â€” crisp bottom, no gear.'
  },
  {
    id: 'bean_breakfast_burritos', name: 'Black bean breakfast burritos', emoji: 'ðŸŒ¯', cuisine: 'Mexican',
    meal: ['breakfast'], diets: ['vegetarian'], allergens: ['gluten', 'eggs', 'dairy'],
    time: 20, servings: 2,
    ing: [
      { f: 'tortillas', q: 2 }, { f: 'eggs', q: 4 }, { f: 'black_beans', q: 200 },
      { f: 'cheddar', q: 60 }, { f: 'salsa', q: 100 }, { f: 'butter', q: 10 }, { f: 'scallions', q: 0.3 }
    ],
    steps: [
      'Warm the beans; scramble the eggs soft in the butter with the scallions.',
      'Warm the tortillas until pliable.',
      'Lay down cheddar first (so it melts), then eggs, beans and salsa, slightly below center.',
      'Fold the sides in, then roll tight from the bottom.',
      'Seal seam-down in the hot pan 1 minute per side. Wrapped in foil, they survive commutes and freezers.'
    ],
    tip: 'The pan-seal is what separates a burrito from a pile.'
  },
  {
    id: 'herb_roasted_chicken_potatoes', name: 'Sheet-pan herb chicken & potatoes', emoji: 'ðŸ—', cuisine: 'American',
    meal: ['dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: [],
    time: 45, servings: 2,
    ing: [
      { f: 'chicken_thigh', q: 450 }, { f: 'potatoes', q: 500 }, { f: 'olive_oil', q: 25 },
      { f: 'oregano', q: 3 }, { f: 'garlic', q: 0.3 }, { f: 'lemon', q: 1 }, { f: 'salt', q: 4 }
    ],
    steps: [
      'Heat the oven to 425Â°F. Halve the baby-cut potatoes (or chunk large ones).',
      'Toss potatoes and chicken with the oil, oregano, minced garlic and salt on a sheet pan.',
      'Arrange skin-side up with space between pieces â€” crowding steams, spacing roasts.',
      'Roast 35 minutes until the chicken hits crisp and the potatoes are golden.',
      'Squeeze the lemon over the whole pan before serving.'
    ],
    tip: 'One pan, one cutting board, one lemon â€” weeknight math that works.'
  },
  {
    id: 'beef_potato_hash', name: 'Crispy beef & potato skillet hash', emoji: 'ðŸ¥”', cuisine: 'American',
    meal: ['dinner', 'breakfast'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: [],
    time: 30, servings: 2,
    ing: [
      { f: 'ground_beef', q: 350 }, { f: 'potatoes', q: 450 }, { f: 'onion', q: 0.5 },
      { f: 'bell_pepper', q: 1 }, { f: 'chili_powder', q: 4 }, { f: 'olive_oil', q: 20 }, { f: 'salt', q: 3 }
    ],
    steps: [
      'Dice the potatoes small and get them crisping in the oil over medium-high, tossing every few minutes, 12â€“15 minutes.',
      'Push aside; brown the beef in the middle, 5 minutes.',
      'Add the diced onion and pepper with the chili powder; cook 4 minutes.',
      'Fold everything together and let it sit untouched 2 minutes for a final crust.',
      'Season and serve â€” a fried egg on top converts it to breakfast.'
    ],
    tip: 'Small dice and patience are the whole secret to crispy skillet potatoes.'
  },
  {
    id: 'honey_lime_chicken_rice', name: 'Honey-lime skillet chicken & rice', emoji: 'ðŸ¯', cuisine: 'Mexican',
    meal: ['dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: [],
    time: 30, servings: 2,
    ing: [
      { f: 'chicken_thigh', q: 400 }, { f: 'honey', q: 25 }, { f: 'lime', q: 2 },
      { f: 'garlic', q: 0.3 }, { f: 'rice', q: 160 }, { f: 'cilantro', q: 0.3 },
      { f: 'chili_powder', q: 4 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Start the rice. Whisk the honey with the juice of both limes, the garlic and chili powder.',
      'Sear the seasoned chicken in the oil, 4â€“5 minutes per side.',
      'Pour the honey-lime over the chicken and let it bubble to a glaze, 2 minutes, turning to coat.',
      'Rest the chicken briefly, then slice.',
      'Serve over rice with the pan glaze and cilantro.'
    ],
    tip: 'Honey burns fast â€” the glaze goes in only after the chicken is basically done.'
  },
  {
    id: 'garlicky_beans_greens_toast', name: 'Garlicky beans & greens on toast', emoji: 'ðŸž', cuisine: 'Mediterranean',
    meal: ['dinner', 'lunch'], diets: ['vegan', 'vegetarian', 'dairy-free'], allergens: ['gluten'],
    time: 15, servings: 2,
    ing: [
      { f: 'chickpeas', q: 400 }, { f: 'spinach', q: 150 }, { f: 'garlic', q: 0.4 },
      { f: 'bread', q: 4 }, { f: 'olive_oil', q: 30 }, { f: 'lemon', q: 0.5 }, { f: 'oregano', q: 2 }
    ],
    steps: [
      'Sizzle the sliced garlic in the oil over medium-low until pale gold â€” not brown â€” 2 minutes.',
      'Add the chickpeas with a splash of their liquid and the oregano; simmer 5 minutes, mashing a third of them.',
      'Fold in the spinach to wilt.',
      'Toast the bread dark and rub it with the cut lemon.',
      'Pile the beans on the toast and finish with lemon juice and oil.'
    ],
    tip: 'Beans on toast, Mediterranean edition â€” pantry dinner with dignity.'
  },
  {
    id: 'shrimp_avocado_rice_bowls', name: 'Chili-lime shrimp & avocado rice bowls', emoji: 'ðŸ¤', cuisine: 'Mexican',
    meal: ['dinner'], diets: ['gluten-free', 'dairy-free', 'high-protein'], allergens: ['shellfish'],
    time: 20, servings: 2,
    ing: [
      { f: 'shrimp', q: 400 }, { f: 'rice', q: 160 }, { f: 'avocado', q: 1 },
      { f: 'lime', q: 2 }, { f: 'chili_powder', q: 6 }, { f: 'cilantro', q: 0.3 },
      { f: 'corn_frozen', q: 100 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Cook the rice; fold in the zest and juice of one lime.',
      'Char the corn in a dry skillet, 3 minutes; set aside.',
      'Toss the dried shrimp with chili powder and salt; sear in the oil 90 seconds per side.',
      'Slice the avocado.',
      'Bowl the rice, corn, shrimp and avocado; finish with the second lime and cilantro.'
    ],
    tip: 'Dry shrimp sear; wet shrimp steam. A paper towel is the best marinade.'
  },
  {
    id: 'pepper_egg_breakfast_tacos', name: 'Charred pepper & egg breakfast tacos', emoji: 'ðŸŒ®', cuisine: 'Mexican',
    meal: ['breakfast'], diets: ['vegetarian', 'dairy-free'], allergens: ['gluten', 'eggs'],
    time: 15, servings: 2,
    ing: [
      { f: 'tortillas', q: 4 }, { f: 'eggs', q: 5 }, { f: 'bell_pepper', q: 1 },
      { f: 'onion', q: 0.3 }, { f: 'salsa', q: 100 }, { f: 'cilantro', q: 0.2 }, { f: 'olive_oil', q: 15 }
    ],
    steps: [
      'Char the sliced pepper and onion in the oil over high heat, 4 minutes, until blistered at the edges.',
      'Drop to medium-low, pour in the whisked eggs, and scramble soft through the vegetables.',
      'Toast the tortillas over the flame or in a dry pan.',
      'Fill with the eggs.',
      'Top with salsa and cilantro.'
    ],
    tip: 'Charred peppers do for eggs what bacon usually gets credit for.'
  },
  {
    id: 'lemon_garlic_salmon_pasta', name: 'Lemon-garlic salmon pasta', emoji: 'ðŸ', cuisine: 'Italian',
    meal: ['dinner'], diets: ['high-protein'], allergens: ['fish', 'gluten', 'dairy'],
    time: 25, servings: 2,
    ing: [
      { f: 'salmon', q: 300 }, { f: 'spaghetti', q: 180 }, { f: 'garlic', q: 0.3 },
      { f: 'lemon', q: 1 }, { f: 'spinach', q: 80 }, { f: 'parmesan', q: 30 },
      { f: 'olive_oil', q: 25 }, { f: 'black_pepper', q: 2 }
    ],
    steps: [
      'Cook the spaghetti; reserve a cup of pasta water.',
      'Sear the salmon in the oil 3 minutes per side; remove and flake.',
      'Soften the sliced garlic in the same pan, 1 minute.',
      'Toss in the pasta, spinach, lemon zest and juice with splashes of pasta water until glossy.',
      'Fold the salmon back in gently, finish with parmesan and black pepper.'
    ],
    tip: 'Flaked fish folded in at the end stays in pieces instead of becoming sauce.'
  }
];
/* =================================================================== */

let failures = 0;
const diets = {}; const cuisines = {};
SEED.forEach((r) => {
  const problems = [];
  if (!r.id || !/^[a-z0-9_]+$/.test(r.id)) problems.push('bad id');
  if (SL.recipes.byId(r.id)) problems.push('id collides with a built-in recipe');
  r.ing.forEach((ing) => {
    if (!SL.foods.byId(ing.f)) problems.push('unknown food: ' + ing.f);
    if (!(ing.q > 0)) problems.push('bad qty for ' + ing.f);
  });
  if (!r.steps || r.steps.length < 3) problems.push('needs 3+ steps');
  const n = SL.nutrition.perServing(r);
  if (!(n.cal >= 120 && n.cal <= 1100)) problems.push('calories out of range: ' + n.cal);
  if (problems.length) {
    failures++;
    console.error('âœ— ' + r.id + ': ' + problems.join('; '));
  } else {
    console.log('âœ“ ' + r.id + '  ' + n.cal + ' cal/serving Â· ' + (r.diets.join(', ') || 'no diet tags') + ' Â· ' + r.cuisine);
  }
  r.diets.forEach((d) => { diets[d] = (diets[d] || 0) + 1; });
  cuisines[r.cuisine] = (cuisines[r.cuisine] || 0) + 1;
});

console.log('\nDiet coverage this batch:', JSON.stringify(diets));
console.log('Cuisine coverage this batch:', JSON.stringify(cuisines));

if (failures) { console.error('\nâœ— ' + failures + ' recipe(s) failed â€” SQL not written.'); process.exit(1); }

const sql = [
  '-- ShelfLife recipe seed batch â€” generated by dev/seed-recipes.js',
  '-- Paste into the Supabase SQL editor. Re-running is safe (upsert).',
  ''
];
SEED.forEach((r) => {
  const doc = JSON.stringify(r).replace(/'/g, "''");
  sql.push("insert into public.recipes (id, doc, status) values ('" + r.id + "', '" + doc + "'::jsonb, 'approved')");
  sql.push("  on conflict (id) do update set doc = excluded.doc, status = 'approved', updated_at = now();");
});
fs.writeFileSync(path.join(__dirname, 'seed-recipes.sql'), sql.join('\n') + '\n');
console.log('\nâœ“ dev/seed-recipes.sql written (' + SEED.length + ' recipes, upsert-safe).');
