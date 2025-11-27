export const LEAVES_KEY_MAP = {
    "コード": "employeeCode",
    "氏名": "name",
    "氏　名": "name",
    "配属先": "assignmentDestination",
    "入社日": "dateJoined",
    "子の出生予定日": "childExpectedDateOfBirth",
    "育休期間": "childcareLeavePeriod",
    "休職区分": "leaveType",
    "休職理由": "leaveReason",
    "有給無給": "isPaid",
    "備考": "remarks",
    "社員№": "employeeCode",
    "スタッフコード": "employeeCode",
    targetEmployeeCode: "対象者社員コード",
    leaveType: "種別",
    employeeName: "対象者社員氏名",
    maternityLeavePeriod: "産前休業",
    postpartumLeavePeriod: "産後休業",
    childcareLeavePeriod: "育児休業",
    paternityLeavePeriod: "育児休業"
    
};

export const LEAVES_CUSTOM_FIELDS = {
    //"詳細備考": 'details',
    details: "詳細備考",
    empStatus: "雇用基盤の状況（garoonより）",
    //"雇用基盤の状況（garoonより）": 'empStatus'
};

export const LEAVE_PROCESSOR_TYPE = {
    '復職': 'LEAVE_RETURN',
    '休業/休職': 'LEAVE',
};