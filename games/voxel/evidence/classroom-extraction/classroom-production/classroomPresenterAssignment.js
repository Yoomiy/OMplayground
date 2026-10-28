"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldBootstrapClassroomPresenter = shouldBootstrapClassroomPresenter;
exports.selectDefaultClassroomPresenter = selectDefaultClassroomPresenter;
exports.commitPresenterAssignment = commitPresenterAssignment;
function shouldBootstrapClassroomPresenter(presenterIdentity, joiningIsHost, spectateMode) {
    return (presenterIdentity === null && joiningIsHost && spectateMode !== "invisible");
}
function selectDefaultClassroomPresenter(participants, creatorIdentity, excludedIdentity = null) {
    const eligibleHosts = participants.filter((participant) => participant.isHost && participant.identity !== excludedIdentity);
    return (eligibleHosts.find((participant) => participant.identity === creatorIdentity)?.identity ??
        eligibleHosts[0]?.identity ??
        null);
}
async function commitPresenterAssignment(previous, identity, keepVisibility, delivery, effects) {
    const next = {
        ...previous,
        presenterIdentity: identity,
        presenterEpoch: previous.presenterEpoch + 1,
        visible: identity ? keepVisibility && previous.visible : false,
        title: identity ? previous.title : null,
        mediaKind: identity ? previous.mediaKind : null,
    };
    await effects.persist(next);
    if (delivery === "persist-only")
        return next;
    await effects.synchronizePermissions(previous, next);
    const capability = effects.createCapability(next);
    await effects.broadcast(next);
    if (identity && capability) {
        await effects.sendCapability(identity, capability, next);
    }
    return next;
}
//# sourceMappingURL=classroomPresenterAssignment.js.map