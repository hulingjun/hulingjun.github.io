export type Concept = {
  id: string;
  title: string;
  cue: string;
  summary: string;
  definition: string;
  includes: string[];
  excludes: string[];
  example: string;
  counterExample: string;
  misconception: string;
  correction: string;
  accent: string;
};

export type Relation = {
  id: string;
  from: string;
  to: string;
  verb: string;
  proposition: string;
  qualification?: string;
};

export const innerConcepts: Concept[] = [
  {
    id: "fact",
    title: "事实",
    cue: "摄像机能记录吗？",
    summary: "可以被观察、记录、原话或其他证据核实的信息。",
    definition: "在当前沟通情境中，可以通过观察、记录、原话或其他证据进行核实的信息。",
    includes: ["对方明确说过的原话", "可观察的具体行为", "可以核实的时间、次数和结果"],
    excludes: ["对动机的推测", "对人格或态度的评价", "由事实引发的情绪"],
    example: "对方连续三天在晚上11点之后向我发送咨询消息。",
    counterExample: "他根本不尊重我的私人时间。",
    misconception: "只要我非常确定，它就是事实。",
    correction: "确定程度不能替代可观察或可验证性。",
    accent: "#246b83",
  },
  {
    id: "interpretation",
    title: "解释",
    cue: "我给事实加了什么含义？",
    summary: "人对事实的含义、原因、动机或后果形成的理解。",
    definition: "人基于已知事实，对事件的含义、原因、动机、后果或他人态度形成的解释。",
    includes: ["对他人动机的推测", "对行为含义的判断", "对未来结果的预测"],
    excludes: ["可以核实的具体行为", "直接命名的情绪", "已经采取的行动"],
    example: "他觉得我的时间不重要。",
    counterExample: "他连续三天在晚上11点之后发来消息。",
    misconception: "解释一定是错误的。",
    correction: "解释可能被证实，但在核实前不能被当作唯一事实。",
    accent: "#7357a1",
  },
  {
    id: "emotion",
    title: "情绪",
    cue: "这是感受，还是评价？",
    summary: "个体在特定情境和解释下产生的主观情感状态。",
    definition: "个体在特定情境和解释下产生的主观情感状态，通常伴随身体感受、行动倾向和注意变化。",
    includes: ["愤怒、害怕和难过", "焦虑、羞愧和内疚", "喜悦、安心和期待"],
    excludes: ["对他人动机的判断", "已经采取的行动", "对他人的人格评价"],
    example: "我看到深夜消息时感到烦躁，也有一点紧张。",
    counterExample: "我感觉他在故意挑战我的底线。",
    misconception: "情绪就是事实的直接结果。",
    correction: "同一事实可能因为不同解释产生不同情绪。",
    accent: "#b24f63",
  },
  {
    id: "behavior",
    title: "行为",
    cue: "我实际做了什么？",
    summary: "个体实际做出或刻意不做出的、原则上可观察的行动。",
    definition: "个体在情境中实际做出或刻意不做出的、原则上可以被观察或记录的行动和表达。",
    includes: ["说出的语言与语气", "发送或不发送消息", "提出问题、设置边界或结束对话"],
    excludes: ["尚未实施的冲动", "情绪状态本身", "对行为动机的评价"],
    example: "我决定第二天工作时间再回复，并说明咨询时间。",
    counterExample: "我很想立刻指责他。",
    misconception: "沉默就是什么都没做。",
    correction: "在沟通中，沉默、回避或不回应也可能构成行为。",
    accent: "#b8692b",
  },
  {
    id: "empathy",
    title: "共情",
    cue: "还有别的可能吗？",
    summary: "尝试理解他人的处境和视角，同时保留自己的判断与边界。",
    definition: "尝试理解他人的处境、感受、需求和视角，同时意识到自己的理解可能不完整，需要核实。",
    includes: ["暂缓唯一解释", "主动生成其他可能性", "通过提问核实", "理解对方同时保留边界"],
    excludes: ["替对方确定动机", "无条件同意", "否定自己的需求", "为伤害性行为找借口"],
    example: "他会不会白天做轮班工作，只有深夜才结束？我还不知道，可以先问。",
    counterExample: "他一定是工作太忙，所以我只能接受。",
    misconception: "共情意味着必须认同对方。",
    correction: "理解对方的视角不等于接受其判断或行为。",
    accent: "#2f7c61",
  },
  {
    id: "conversational-safety",
    title: "对话安全感",
    cue: "真实信息还在流动吗？",
    summary: "参与者能够相对坦诚表达重要信息和不同意见的互动状态。",
    definition: "参与者能够相对坦诚地表达信息、疑问和不同意见，而不必主要担心被羞辱、惩罚、威胁或排斥。",
    includes: ["可以表达不同意见", "可以提出问题和核实理解", "能够明确边界而不贬低对方"],
    excludes: ["双方必须意见一致", "对话没有任何不适", "为了避免冲突而隐藏重要信息"],
    example: "我通常不在晚上处理咨询。你一般只有晚上方便吗？我们可以确认一个双方都合适的时间。",
    counterExample: "如果你再这样，我以后就不管你了。",
    misconception: "安全就是没有冲突。",
    correction: "安全对话可以存在明显分歧，关键是分歧能否被表达和处理。",
    accent: "#275e55",
  },
];

export const innerRelations: Relation[] = [
  { id: "fact-interpretation", from: "事实", to: "解释", verb: "被人赋予含义", proposition: "人通常会对观察到的事实赋予含义，从而形成解释。", qualification: "解释可能被证实，但在核实前不是唯一事实。" },
  { id: "interpretation-emotion", from: "解释", to: "情绪", verb: "影响", proposition: "对同一事实形成的不同解释，可能产生不同的情绪反应。", qualification: "影响不等于必然决定。" },
  { id: "emotion-behavior", from: "情绪", to: "行为", verb: "影响", proposition: "情绪会改变行动倾向和表达方式，从而影响行为选择。", qualification: "人可以在觉察后选择不同的行动。" },
  { id: "empathy-interpretation", from: "共情", to: "解释", verb: "帮助修正", proposition: "理解他人处境并保持不确定性，有助于发现原有解释并非唯一答案。" },
  { id: "interpretation-safety", from: "审视解释", to: "安全感", verb: "支持", proposition: "区分事实和解释、减少未经核实的动机归因，有助于支持对话安全。", qualification: "它只是安全对话的一个条件，不是全部。" },
];

export const goalConcepts: Concept[] = [
  {
    id: "content", title: "内容", cue: "这一次具体发生了什么？", summary: "当前需要讨论的具体事件、任务、决定或结果。", definition: "当前需要讨论的某个具体事件、任务、行为、信息、决定或结果。",
    includes: ["某一次未按时交付", "某一条具体消息", "一个具体决定"], excludes: ["跨事件重复规律", "长期信任变化", "共同决策方式"], example: "确认昨天没有交付的报告何时完成。", counterExample: "你每次都要等我催促才会提交。", misconception: "出现具体例子就是内容目标。", correction: "具体例子也可能用于说明更深层的模式或关系问题。", accent: "#c75b45",
  },
  {
    id: "pattern", title: "模式", cue: "反复发生了什么？", summary: "跨多个事件或时间点反复出现的行为或互动规律。", definition: "在多个事件、时间点或情境中反复出现，并对结果产生持续影响的行为或互动规律。",
    includes: ["多次迟交", "每次分歧就回避", "反复越过已经说明的边界"], excludes: ["单个事件", "没有证据的总是或从不", "人格标签"], example: "过去四周有三次报告是在提醒后才提交。", counterExample: "你就是一个不负责任的人。", misconception: "指出模式就是使用总是和从不。", correction: "模式需要具体证据和范围限定。", accent: "#8b5c9d",
  },
  {
    id: "relationship", title: "关系", cue: "我们处于什么关系状态？", summary: "双方持续互动中形成的信任、角色、边界和合作状态。", definition: "双方在持续互动中形成的信任、尊重、角色、边界、可靠性和合作状态。",
    includes: ["是否仍然信任对方", "角色和责任是否清楚", "边界是否被理解和维护"], excludes: ["某一次具体任务", "重复行为本身", "会议采用什么议程"], example: "我越来越不愿意把重要任务交给你，希望讨论如何恢复可靠感。", counterExample: "这份报告应该在周五之前提交。", misconception: "关系目标就是让关系和谐。", correction: "关系目标也可能是明确角色、重设边界或结束合作。", accent: "#39756d",
  },
  {
    id: "process", title: "流程", cue: "我们如何一起沟通和做事？", summary: "参与者交换信息、决策、协作和解决问题的方式与规则。", definition: "参与者用于交换信息、表达分歧、做出决定、分配责任、反馈和解决问题的方式与规则。",
    includes: ["谁在什么时候参与讨论", "信息通过什么渠道共享", "决定由谁以什么规则做出"], excludes: ["当前要决定的事项", "重复行为本身", "双方信任状态"], example: "重新约定谁需要在决定做出前参与讨论。", counterExample: "这次到底选择方案A还是方案B？", misconception: "流程就是复杂制度。", correction: "两个人约定如何提问、回复和确认也属于流程。", accent: "#356a98",
  },
];

export const goalScenarios = [
  { id: "first-delay", title: "第一次迟交", text: "同事第一次没有在约定时间提交报告，项目正在等待这份材料。", primary: "内容", secondary: [], rationale: "现有信息只支持一次具体事件，当前首先需要确认交付时间和解决阻塞。" },
  { id: "repeated-delay", title: "反复迟交", text: "最近四周，同事三次没有按约定时间提交报告，每次都需要提醒。", primary: "模式", secondary: ["关系"], rationale: "真正希望改变的是跨多个事件重复出现的行为规律；如果它已经影响任务委托意愿，关系也可能成为次要目标。" },
  { id: "trust", title: "信任下降", text: "对方最近能够按时提交，但此前长期失约后，你仍然不愿把重要工作交给他。", primary: "关系", secondary: [], rationale: "当前主要障碍不再是某次交付，而是可靠感、信任和合作状态。" },
  { id: "decision", title: "决策方式", text: "团队总在管理者决定后才通知执行者，执行者不断提出相同异议。", primary: "流程", secondary: ["模式"], rationale: "如果希望改变谁参与决策、何时参与以及如何确认决定，主要目标指向共同流程。" },
  { id: "late-message", title: "深夜咨询", text: "用户连续三天在晚上11点后咨询，双方此前没有约定服务时间和回复时限。", primary: "流程", secondary: ["模式", "关系"], rationale: "如果希望双方明确什么时候可以发消息、什么时候会得到回复，主要目标是共同沟通流程。" },
];
