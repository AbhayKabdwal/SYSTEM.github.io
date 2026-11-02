import type { Quest, QuestTask, Rank, SkillTree, Template } from './types';

// Game data carried over unchanged from the v1 single-file app.

export const RANKS: Rank[]=[
  {min:0,level:1,rank:'E',title:'Weakling',color:'#778899'},
  {min:5,level:5,rank:'E',title:'Novice Hunter',color:'#99aacc'},
  {min:15,level:10,rank:'D',title:'Apprentice',color:'#4499ff'},
  {min:30,level:20,rank:'D',title:'Fighter',color:'#44aaff'},
  {min:50,level:35,rank:'C',title:'Warrior',color:'#44ffaa'},
  {min:75,level:50,rank:'B',title:'Shadow Soldier',color:'#bb44ff'},
  {min:100,level:70,rank:'A',title:'Elite Hunter',color:'#ff8844'},
  {min:150,level:90,rank:'S',title:'Shadow Monarch',color:'#ffdd00'},
  {min:200,level:100,rank:'S',title:'Sung Jin-Woo',color:'#ffffff'},
];
export const DEFAULT_QUEST_POOL: QuestTask[]=[
  {id:'skipping',label:'Skipping',target:10,unit:'min'},
  {id:'jumping_jacks',label:'Jumping Jacks',target:100,unit:'reps'},
  {id:'pushups',label:'Push-ups',target:100,unit:'reps'},
  {id:'alternate_toe_touch',label:'Alternate Toe Touch',target:80,unit:'reps'},
  {id:'burpees',label:'Burpees',target:50,unit:'reps'},
  {id:'running',label:'Running',target:3,unit:'km'},
  {id:'squats',label:'Squats',target:100,unit:'reps'},
  {id:'situps',label:'Sit-ups',target:100,unit:'reps'},
  {id:'mountain_climbers',label:'Mountain Climbers',target:100,unit:'reps'},
];
export const PENALTY_QUEST: Quest={name:'PENALTY QUEST: SURVIVAL TRAINING',tasks:[
  {id:'burpees',label:'Burpees',target:50,unit:'reps'},
  {id:'squats',label:'Squats',target:100,unit:'reps'},
  {id:'plank',label:'Plank Hold',target:180,unit:'sec'},
]};
export const RECOVERY_QUEST: Quest={name:'DELOAD QUEST: RECOVERY PROTOCOL',tasks:[
  {id:'walk',label:'Easy Walk',target:20,unit:'min'},
  {id:'mobility',label:'Mobility Flow',target:15,unit:'min'},
  {id:'breathing',label:'Breathing Reset',target:5,unit:'min'},
]};
export const DEFAULT_TEMPLATES: Template[]=[
  {id:'tpl_chest',name:'CHEST DAY',color:'#ff4455',exercises:[
    {id:'e_bpress',name:'Bench Press',unit:'kg'},
    {id:'e_ipress',name:'Incline Bench Press',unit:'kg'},
    {id:'e_pushup',name:'Push-ups',unit:'reps'},
    {id:'e_cfly',name:'Cable Flies',unit:'kg'},
  ]},
  {id:'tpl_back',name:'BACK DAY',color:'#4488ff',exercises:[
    {id:'e_dead',name:'Deadlift',unit:'kg'},
    {id:'e_pull',name:'Pull-ups',unit:'reps'},
    {id:'e_brow',name:'Barbell Rows',unit:'kg'},
    {id:'e_latpull',name:'Lat Pulldown',unit:'kg'},
  ]},
  {id:'tpl_legs',name:'LEG DAY',color:'#44ffaa',exercises:[
    {id:'e_squat',name:'Squats',unit:'kg'},
    {id:'e_lpress',name:'Leg Press',unit:'kg'},
    {id:'e_rdl',name:'Romanian Deadlift',unit:'kg'},
    {id:'e_run',name:'Running',unit:'km'},
  ]},
  {id:'tpl_shoulders',name:'SHOULDER DAY',color:'#aa44ff',exercises:[
    {id:'e_ohp',name:'Overhead Press',unit:'kg'},
    {id:'e_lraise',name:'Lateral Raises',unit:'kg'},
    {id:'e_fpull',name:'Face Pulls',unit:'kg'},
    {id:'e_shrug',name:'Shrugs',unit:'kg'},
  ]},
  {id:'tpl_arms',name:'ARMS DAY',color:'#ffaa44',exercises:[
    {id:'e_bbcurl',name:'Barbell Curls',unit:'kg'},
    {id:'e_tpush',name:'Tricep Pushdowns',unit:'kg'},
    {id:'e_hammer',name:'Hammer Curls',unit:'kg'},
    {id:'e_skull',name:'Skull Crushers',unit:'kg'},
  ]},
  {id:'tpl_cardio',name:'CARDIO',color:'#ffdd44',exercises:[
    {id:'e_crun',name:'Running',unit:'km'},
    {id:'e_jrope',name:'Jump Rope',unit:'min'},
    {id:'e_cycle',name:'Cycling',unit:'km'},
    {id:'e_burpee',name:'Burpees',unit:'reps'},
  ]},
  {id:'tpl_calis',name:'CALISTHENICS',color:'#00c8ff',exercises:[
    {id:'e_pull_bw',name:'Pull-ups',unit:'reps'},
    {id:'e_dip_bw',name:'Dips',unit:'reps'},
    {id:'e_pike',name:'Pike Push-ups',unit:'reps'},
    {id:'e_lsit',name:'L-Sit Hold',unit:'sec'},
  ]},
];
export const SKILL_TREES: SkillTree[]=[
  {id:'planche',name:'PLANCHE',nodes:[
    {id:'frog_stand',label:'Frog Stand',req:30},
    {id:'tuck_planche',label:'Tuck Planche',req:20,deps:['frog_stand']},
    {id:'advanced_tuck',label:'Advanced Tuck',req:20,deps:['tuck_planche']},
    {id:'straddle_planche',label:'Straddle Planche',req:10,deps:['advanced_tuck']},
    {id:'full_planche',label:'Full Planche',req:5,deps:['straddle_planche']},
  ]},
  {id:'front_lever',name:'FRONT LEVER',nodes:[
    {id:'tuck_lever',label:'Tuck Lever',req:30},
    {id:'adv_tuck_lever',label:'Advanced Tuck',req:20,deps:['tuck_lever']},
    {id:'one_leg_lever',label:'One Leg Lever',req:20,deps:['adv_tuck_lever']},
    {id:'straddle_lever',label:'Straddle Lever',req:12,deps:['one_leg_lever']},
    {id:'full_front_lever',label:'Full Front Lever',req:8,deps:['straddle_lever']},
  ]},
  {id:'muscle_up',name:'MUSCLE-UP',nodes:[
    {id:'strict_pullup',label:'Strict Pull-up',req:10},
    {id:'ctb_pullup',label:'Chest-to-Bar',req:6,deps:['strict_pullup']},
    {id:'transition_drill',label:'Transition Drill',req:10,deps:['ctb_pullup']},
    {id:'banded_mu',label:'Banded Muscle-up',req:5,deps:['transition_drill']},
    {id:'strict_mu',label:'Strict Muscle-up',req:3,deps:['banded_mu']},
  ]},
  {id:'handstand',name:'HSPU',nodes:[
    {id:'wall_hs',label:'Wall Handstand',req:45},
    {id:'pike_pu',label:'Pike Push-up',req:15,deps:['wall_hs']},
    {id:'wall_hspu_neg',label:'HSPU Negative',req:8,deps:['pike_pu']},
    {id:'wall_hspu',label:'Wall HSPU',req:5,deps:['wall_hspu_neg']},
    {id:'free_hspu',label:'Freestanding HSPU',req:3,deps:['wall_hspu']},
  ]},
  {id:'pistol',name:'PISTOL',nodes:[
    {id:'box_pistol',label:'Box Pistol',req:12},
    {id:'assisted_pistol',label:'Assisted Pistol',req:10,deps:['box_pistol']},
    {id:'negative_pistol',label:'Negative Pistol',req:6,deps:['assisted_pistol']},
    {id:'pistol_squat',label:'Pistol Squat',req:5,deps:['negative_pistol']},
    {id:'weighted_pistol',label:'Weighted Pistol',req:3,deps:['pistol_squat']},
  ]},
  {id:'lsit',name:'L-SIT',nodes:[
    {id:'tuck_lsit',label:'Tuck L-Sit',req:30},
    {id:'one_leg_lsit',label:'One Leg L-Sit',req:20,deps:['tuck_lsit']},
    {id:'l_sit',label:'L-Sit',req:20,deps:['one_leg_lsit']},
    {id:'tuck_vsit',label:'Tuck V-Sit',req:12,deps:['l_sit']},
    {id:'v_sit',label:'V-Sit',req:8,deps:['tuck_vsit']},
  ]},
];
