/* ============================================================================
   NLP — free-text -> structured symptom tags (Processing & Structuring layer)
   Pure module: runs identically on the server (authoritative) and client.
   ============================================================================ */

// tag -> { label, phrases[], redFlag?, cat }
export const LEX = {
  appetite_decline:{label:"Appetite decline",cat:"diet",phrases:["not eating","isn't eating","isnt eating","won't eat","wont eat","refusing food","eating less","less appetite","off his food","off her food","skipping meals","no appetite"]},
  appetite_increase:{label:"Increased appetite",cat:"diet",phrases:["eating more","always hungry","increased appetite","ravenous","begging for food constantly"]},
  weight_loss:{label:"Weight loss",cat:"weight",phrases:["losing weight","weight loss","getting thin","ribs showing","bonier"]},
  weight_gain:{label:"Weight gain",cat:"weight",phrases:["gaining weight","weight gain","getting fat","heavier","chunkier"]},
  lethargy:{label:"Lethargy / low energy",cat:"behavior",phrases:["lethargic","low energy","no energy","sleeping more","sluggish","very tired","not playing","listless"]},
  vomiting:{label:"Vomiting",cat:"gi",phrases:["vomit","throwing up","threw up","puking","puked","being sick","hairball"]},
  diarrhea:{label:"Diarrhea",cat:"gi",phrases:["diarrhea","diarrhoea","loose stool","runny poop","soft stool"]},
  constipation:{label:"Constipation",cat:"gi",phrases:["constipat","straining to poop","hard stool","no poop","hasn't pooped","hasnt pooped"]},
  excessive_thirst:{label:"Increased thirst",cat:"behavior",phrases:["drinking more","always thirsty","increased thirst","drinking a lot","drinking constantly"]},
  urination_changes:{label:"Litter/urination change",cat:"urinary",phrases:["peeing more","peeing outside","not using litter","frequent urination","small clumps","peeing everywhere"]},
  grooming_decline:{label:"Grooming decline",cat:"grooming",phrases:["not grooming","stopped grooming","matted","greasy coat","unkempt","dull coat","dandruff"]},
  overgrooming:{label:"Overgrooming",cat:"grooming",phrases:["overgrooming","over grooming","bald patches","licking too much","pulling fur","barbering"]},
  hiding:{label:"Hiding / withdrawn",cat:"behavior",phrases:["hiding","withdrawn","antisocial","under the bed all day"]},
  aggression:{label:"Irritability / aggression",cat:"behavior",phrases:["aggressive","hissing","biting","swatting","grumpy"]},
  dental:{label:"Dental / mouth concern",cat:"dental",phrases:["bad breath","drooling","mouth","teeth","tartar","red gums","pawing at mouth"]},
  eye:{label:"Eye concern",cat:"eye",phrases:["eye discharge","squinting","watery eye","cloudy eye","red eye"]},
  // ---- RED FLAGS (urgent) ----
  not_urinating:{label:"Not urinating / straining",cat:"urinary",redFlag:true,phrases:["not peeing","can't pee","cant pee","straining to pee","blood in urine","crying in litter","in and out of litter"]},
  breathing:{label:"Breathing difficulty",cat:"respiratory",redFlag:true,phrases:["trouble breathing","labored breathing","panting","open mouth breathing","wheezing","gasping","fast breathing"]},
  repeated_vomiting:{label:"Repeated vomiting",cat:"gi",redFlag:true,phrases:["keeps vomiting","vomiting repeatedly","can't keep water down","vomiting all day","many times"]},
  collapse:{label:"Collapse / weakness",cat:"emergency",redFlag:true,phrases:["collapsed","can't stand","cant stand","unresponsive","fainted","seizure","seizing","convulsing","twitching uncontrollably"]},
  toxin:{label:"Possible poisoning",cat:"emergency",redFlag:true,phrases:["ate a lily","ate lily","ate chocolate","ate onion","ate a plant","swallowed","ate string","ate a thread","antifreeze","ate medication","ate a pill"]},
  pain:{label:"Signs of pain",cat:"emergency",redFlag:true,phrases:["crying out","yowling in pain","limping badly","won't move","wont move","distended belly","swollen belly","pale gums"]},
  jaundice:{label:"Jaundice",cat:"emergency",redFlag:true,phrases:["yellow gums","yellow eyes","yellow skin","jaundice"]},
};

export function matchTags(text){
  const t = " " + String(text||"").toLowerCase().replace(/[’]/g,"'") + " ";
  const found = [];
  for(const [tag,def] of Object.entries(LEX)){
    for(const p of def.phrases){
      if(t.includes(p)){ found.push({tag, label:def.label, redFlag:!!def.redFlag, cat:def.cat, evidence:p}); break; }
    }
  }
  return found;
}

export const isRedFlag = (tag) => !!(LEX[tag] && LEX[tag].redFlag);
export const label = (tag) => (LEX[tag] ? LEX[tag].label : tag);
