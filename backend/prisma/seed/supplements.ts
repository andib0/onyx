export const supplements = [
  // ESSENTIAL
  { name: 'Creatine Monohydrate', category: 'Essential', typicalDose: '5g daily', timingRecommendation: 'Any time, consistency matters more than timing', benefits: 'Increases strength, power output, muscle hydration, cognitive function', precautions: 'May cause water retention initially. Stay hydrated.' },
  { name: 'Vitamin D3', category: 'Essential', typicalDose: '2000-5000 IU daily', timingRecommendation: 'With a meal containing fat for better absorption', benefits: 'Bone health, immune function, mood, testosterone support', precautions: 'Get levels tested. High doses can cause toxicity.' },
  { name: 'Omega-3 Fish Oil', category: 'Essential', typicalDose: '1-3g EPA+DHA daily', timingRecommendation: 'With meals to reduce fishy burps', benefits: 'Heart health, brain function, inflammation reduction, joint health', precautions: 'May thin blood. Stop before surgery.' },
  { name: 'Magnesium Glycinate', category: 'Essential', typicalDose: '200-400mg daily', timingRecommendation: 'Before bed (promotes relaxation)', benefits: 'Sleep quality, muscle relaxation, stress reduction, over 300 enzymatic reactions', precautions: 'High doses may cause loose stools.' },
  { name: 'Magnesium Citrate', category: 'Essential', typicalDose: '200-400mg daily', timingRecommendation: 'Any time, can take with or without food', benefits: 'Muscle function, energy production, sleep support', precautions: 'Higher doses may have laxative effect.' },
  { name: 'Zinc', category: 'Essential', typicalDose: '15-30mg daily', timingRecommendation: 'With food to prevent nausea', benefits: 'Immune function, testosterone, wound healing, protein synthesis', precautions: 'Do not exceed 40mg/day. Can cause copper deficiency.' },
  { name: 'Vitamin K2 (MK-7)', category: 'Essential', typicalDose: '100-200mcg daily', timingRecommendation: 'With Vitamin D3 and fat-containing meal', benefits: 'Directs calcium to bones, cardiovascular health', precautions: 'May interact with blood thinners.' },
  { name: 'Vitamin B12', category: 'Essential', typicalDose: '500-1000mcg daily', timingRecommendation: 'Morning, with or without food', benefits: 'Energy production, nervous system function, red blood cell formation', precautions: 'Essential for vegans/vegetarians. Generally very safe.' },
  { name: 'Iron', category: 'Essential', typicalDose: '18-45mg daily (if deficient)', timingRecommendation: 'Empty stomach for best absorption, or with vitamin C', benefits: 'Oxygen transport, energy, cognitive function', precautions: 'Get levels tested first. Too much can be harmful.' },
  { name: 'Vitamin B Complex', category: 'Essential', typicalDose: '1 daily as directed', timingRecommendation: 'Morning with food', benefits: 'Energy metabolism, nervous system, mood support', precautions: 'May turn urine bright yellow. Normal and harmless.' },

  // PERFORMANCE
  { name: 'Caffeine', category: 'Performance', typicalDose: '100-400mg pre-workout', timingRecommendation: '30-60 minutes before training. Avoid after 2-4pm.', benefits: 'Energy, focus, endurance, strength, fat oxidation', precautions: 'Builds tolerance. Can disrupt sleep. Max 400mg/day.' },
  { name: 'Beta-Alanine', category: 'Performance', typicalDose: '3-5g daily', timingRecommendation: 'Split doses to avoid tingling, or take with pre-workout', benefits: 'Endurance, reduces fatigue in 60-240 second efforts', precautions: 'Causes harmless tingling (paresthesia).' },
  { name: 'Citrulline Malate', category: 'Performance', typicalDose: '6-8g pre-workout', timingRecommendation: '30-60 minutes before training', benefits: 'Blood flow, pumps, endurance, reduces soreness', precautions: 'Generally well tolerated.' },
  { name: 'L-Citrulline', category: 'Performance', typicalDose: '3-6g pre-workout', timingRecommendation: '30-60 minutes before training', benefits: 'Nitric oxide production, blood flow, pumps', precautions: 'Generally well tolerated.' },
  { name: 'Beetroot Powder', category: 'Performance', typicalDose: '500mg nitrates or 6g powder', timingRecommendation: '2-3 hours before endurance exercise', benefits: 'Nitric oxide, endurance, blood pressure', precautions: 'May turn urine/stool pink. Normal.' },
  { name: 'Taurine', category: 'Performance', typicalDose: '1-3g daily', timingRecommendation: 'Pre or post workout', benefits: 'Hydration, endurance, antioxidant, heart health', precautions: 'Very safe. High doses may cause GI upset.' },
  { name: 'Tyrosine', category: 'Performance', typicalDose: '500-2000mg', timingRecommendation: '30-60 minutes before training or stressful situations', benefits: 'Focus, alertness under stress, dopamine precursor', precautions: 'Avoid if taking MAOIs. May interact with thyroid medication.' },
  { name: 'Alpha-GPC', category: 'Performance', typicalDose: '300-600mg daily', timingRecommendation: 'Morning or pre-workout', benefits: 'Choline source, focus, memory, power output', precautions: 'May cause headaches. Start low.' },

  // RECOVERY
  { name: 'Whey Protein Isolate', category: 'Recovery', typicalDose: '20-40g per serving', timingRecommendation: 'Post-workout or as needed to hit protein goals', benefits: 'Fast-absorbing protein, muscle protein synthesis, convenient', precautions: 'Lactose-free option for those intolerant.' },
  { name: 'Whey Protein Concentrate', category: 'Recovery', typicalDose: '20-40g per serving', timingRecommendation: 'Post-workout or between meals', benefits: 'Cost-effective protein, good amino acid profile', precautions: 'May contain lactose. Check if sensitive.' },
  { name: 'Casein Protein', category: 'Recovery', typicalDose: '20-40g per serving', timingRecommendation: 'Before bed or between meals', benefits: 'Slow-release protein, overnight recovery, satiety', precautions: 'Contains lactose. Slower digestion.' },
  { name: 'BCAAs', category: 'Recovery', typicalDose: '5-10g peri-workout', timingRecommendation: 'During or after training', benefits: 'May help during fasted training, recovery', precautions: 'Unnecessary if eating enough protein.' },
  { name: 'EAAs', category: 'Recovery', typicalDose: '10-15g peri-workout', timingRecommendation: 'During or after training', benefits: 'Complete amino acid profile, recovery, muscle protein synthesis', precautions: 'More effective than BCAAs alone.' },
  { name: 'Glutamine', category: 'Recovery', typicalDose: '5-10g daily', timingRecommendation: 'Post-workout or before bed', benefits: 'Gut health, immune function, recovery', precautions: 'May be unnecessary with adequate protein intake.' },
  { name: 'HMB', category: 'Recovery', typicalDose: '3g daily', timingRecommendation: 'Split into 1g doses with meals', benefits: 'Anti-catabolic, useful during cutting or for beginners', precautions: 'Most beneficial for new lifters or during caloric deficit.' },

  // HEALTH & WELLNESS
  { name: 'Multivitamin', category: 'Health', typicalDose: '1 daily as directed', timingRecommendation: 'With food for better absorption', benefits: 'Insurance for micronutrient gaps', precautions: 'Do not mega-dose. More is not better.' },
  { name: 'Vitamin C', category: 'Health', typicalDose: '500-1000mg daily', timingRecommendation: 'With meals', benefits: 'Immune function, antioxidant, collagen synthesis', precautions: 'High doses may cause GI upset.' },
  { name: 'Ashwagandha (KSM-66)', category: 'Health', typicalDose: '300-600mg daily', timingRecommendation: 'Morning or before bed', benefits: 'Stress reduction, cortisol management, may boost testosterone', precautions: 'May cause drowsiness. Avoid with thyroid medication.' },
  { name: 'Ashwagandha (Sensoril)', category: 'Health', typicalDose: '125-250mg daily', timingRecommendation: 'Morning or evening', benefits: 'Stress reduction, sleep quality, adaptogenic', precautions: 'More sedating than KSM-66. Avoid with thyroid issues.' },
  { name: 'Probiotics', category: 'Health', typicalDose: '10-50 billion CFU daily', timingRecommendation: 'With or without food (strain dependent)', benefits: 'Gut health, immune function, digestion', precautions: 'May cause initial bloating.' },
  { name: 'Collagen Peptides', category: 'Health', typicalDose: '10-20g daily', timingRecommendation: 'Any time, with vitamin C for absorption', benefits: 'Skin, hair, nails, joint support, gut lining', precautions: 'Generally very safe.' },
  { name: 'Melatonin', category: 'Health', typicalDose: '0.5-3mg', timingRecommendation: '30-60 minutes before bed', benefits: 'Sleep onset, jet lag, circadian rhythm', precautions: 'Start low. Not for long-term daily use.' },
  { name: 'Glycine', category: 'Health', typicalDose: '3-5g before bed', timingRecommendation: '30-60 minutes before sleep', benefits: 'Sleep quality, collagen synthesis, cognitive function', precautions: 'Very safe. May enhance sleep.' },
  { name: 'NAC (N-Acetyl Cysteine)', category: 'Health', typicalDose: '600-1200mg daily', timingRecommendation: 'Empty stomach or with meals', benefits: 'Antioxidant, liver support, respiratory health, glutathione precursor', precautions: 'May interact with some medications.' },
  { name: 'Coenzyme Q10', category: 'Health', typicalDose: '100-300mg daily', timingRecommendation: 'With fat-containing meal', benefits: 'Energy production, heart health, antioxidant', precautions: 'Essential if on statins.' },

  // JOINT & BONE
  { name: 'Glucosamine', category: 'Joint', typicalDose: '1500mg daily', timingRecommendation: 'With meals, split doses', benefits: 'Joint health, cartilage support', precautions: 'Shellfish-derived versions exist. Takes weeks to work.' },
  { name: 'Chondroitin', category: 'Joint', typicalDose: '800-1200mg daily', timingRecommendation: 'With meals, often combined with glucosamine', benefits: 'Joint cushioning, cartilage support', precautions: 'May take 2-4 months for full effect.' },
  { name: 'MSM', category: 'Joint', typicalDose: '1-3g daily', timingRecommendation: 'With meals', benefits: 'Joint health, inflammation, recovery', precautions: 'May cause GI upset at high doses.' },
  { name: 'Turmeric/Curcumin', category: 'Joint', typicalDose: '500-1000mg curcumin with piperine', timingRecommendation: 'With food containing fat', benefits: 'Anti-inflammatory, joint health, antioxidant', precautions: 'Needs piperine for absorption. May thin blood.' },
  { name: 'Boswellia', category: 'Joint', typicalDose: '300-500mg daily', timingRecommendation: 'With meals', benefits: 'Joint inflammation, mobility', precautions: 'Generally well tolerated.' },
  { name: 'Type II Collagen', category: 'Joint', typicalDose: '40mg daily (UC-II)', timingRecommendation: 'On empty stomach', benefits: 'Joint health, cartilage support, immune modulation', precautions: 'Different from collagen peptides. Low dose is key.' },

  // COGNITIVE
  { name: 'L-Theanine', category: 'Cognitive', typicalDose: '100-200mg', timingRecommendation: 'With caffeine for synergy, or before bed for relaxation', benefits: 'Calm focus, reduces caffeine jitters, relaxation', precautions: 'Very safe. May cause drowsiness.' },
  { name: 'Lions Mane', category: 'Cognitive', typicalDose: '500-1000mg daily', timingRecommendation: 'Morning with food', benefits: 'Nerve growth factor, cognitive function, mood', precautions: 'May cause GI upset. Avoid with bleeding disorders.' },
  { name: 'Rhodiola Rosea', category: 'Cognitive', typicalDose: '200-600mg daily', timingRecommendation: 'Morning, empty stomach', benefits: 'Adaptogen, fatigue reduction, stress resilience', precautions: 'May cause insomnia if taken late. Stimulating.' },
  { name: 'Bacopa Monnieri', category: 'Cognitive', typicalDose: '300-450mg daily', timingRecommendation: 'With fat-containing meal', benefits: 'Memory, learning, anxiety reduction', precautions: 'Takes 8-12 weeks for full effect. May cause GI issues.' },
  { name: 'Ginkgo Biloba', category: 'Cognitive', typicalDose: '120-240mg daily', timingRecommendation: 'With meals, split doses', benefits: 'Blood flow to brain, memory, cognitive function', precautions: 'May thin blood. Avoid before surgery.' },
  { name: 'Phosphatidylserine', category: 'Cognitive', typicalDose: '100-300mg daily', timingRecommendation: 'With meals', benefits: 'Cognitive function, cortisol reduction, memory', precautions: 'May interact with blood thinners.' },

  // TESTOSTERONE & HORMONES
  { name: 'Tongkat Ali (Longjack)', category: 'Hormones', typicalDose: '200-400mg daily', timingRecommendation: 'Morning with food', benefits: 'May support testosterone, libido, stress reduction', precautions: 'Cycle usage. May cause insomnia.' },
  { name: 'Fenugreek', category: 'Hormones', typicalDose: '500-600mg daily', timingRecommendation: 'With meals', benefits: 'May support testosterone, libido, blood sugar', precautions: 'May cause maple syrup smell in sweat/urine.' },
  { name: 'DHEA', category: 'Hormones', typicalDose: '25-50mg daily', timingRecommendation: 'Morning with food', benefits: 'Hormone precursor, may support testosterone and mood', precautions: 'Get levels tested. May have hormonal side effects.' },
  { name: 'Boron', category: 'Hormones', typicalDose: '3-10mg daily', timingRecommendation: 'With food', benefits: 'May support testosterone, bone health', precautions: 'Do not exceed 20mg/day.' },

  // SLEEP
  { name: 'Magnesium L-Threonate', category: 'Sleep', typicalDose: '1-2g daily (144mg elemental)', timingRecommendation: 'Before bed', benefits: 'Brain magnesium levels, sleep quality, cognitive function', precautions: 'More expensive than other forms.' },
  { name: 'L-Tryptophan', category: 'Sleep', typicalDose: '500-1000mg', timingRecommendation: '30-60 minutes before bed, empty stomach', benefits: 'Serotonin precursor, sleep onset, mood', precautions: 'May interact with SSRIs. Avoid with certain medications.' },
  { name: '5-HTP', category: 'Sleep', typicalDose: '50-200mg', timingRecommendation: 'Before bed or with meals', benefits: 'Serotonin production, sleep, mood', precautions: 'Do not combine with SSRIs or MAOIs.' },
  { name: 'GABA', category: 'Sleep', typicalDose: '250-750mg', timingRecommendation: 'Before bed', benefits: 'Relaxation, sleep support, anxiety reduction', precautions: 'Poor blood-brain barrier penetration in some people.' },
  { name: 'Valerian Root', category: 'Sleep', typicalDose: '300-600mg', timingRecommendation: '30-60 minutes before bed', benefits: 'Sleep quality, relaxation, anxiety reduction', precautions: 'May cause morning grogginess.' },
  { name: 'Apigenin', category: 'Sleep', typicalDose: '50mg', timingRecommendation: '30-60 minutes before bed', benefits: 'Relaxation, sleep onset, anxiety reduction', precautions: 'Found in chamomile. Generally safe.' },
];
