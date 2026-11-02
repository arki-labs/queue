/**
 * Turn a built flow into BullMQ flow jobs, and start it.
 *
 * A flow is a BullMQ tree. A step that no other step depends on is a root.
 * The steps in its `dependsOn` become its children, recursively. BullMQ runs
 * the children first and the parent once all of them completed. The flow
 * builder already rejected cycles and steps with two dependents, so every
 * step lands in exactly one tree, exactly once.
 */
import { InvalidInput, isFailure, UnexpectedDefect, ValidatorDefect } from '@arki/failure';
import { parseAsync } from '@arki/schema';
import { debugFlow, observeQueue } from './debug.js';
import { withEnqueueSpan } from './enqueue-span.js';
import { jobDefaultOptions, jobRetryOptions } from './job-options.js';
import { jobTraceOptions } from './job-trace.js';
import { QueueAcceptanceUnknown } from './errors.js';
export const FLOW_ENQUEUE_FAILURES = [InvalidInput, ValidatorDefect, UnexpectedDefect, QueueAcceptanceUnknown];
/** The flow's steps as trees, roots in declaration order. */
function stepTrees(flow) {
    const byId = new Map(flow.steps.map(step => [step.id, step]));
    const hasDependent = new Set(flow.steps.flatMap(step => step.dependsOn ?? []));
    const treeOf = (step) => ({
        step,
        children: [...new Set(step.dependsOn)].flatMap(id => {
            const child = byId.get(id);
            return child === undefined ? [] : [treeOf(child)];
        }),
    });
    return flow.steps.filter(step => !hasDependent.has(step.id)).map(step => treeOf(step));
}
function toFlowJobNode(tree, input) {
    const { job } = tree.step;
    // The worker of a job reads the queue named after the job: the same queue `enqueue(job)` adds to.
    const queueName = job._internal.name;
    const node = {
        name: queueName,
        queueName,
        data: tree.step.data(input),
        // What the job's queue would apply on `add()`, then the step's own options
        opts: {
            ...jobDefaultOptions(job._internal.options),
            ...jobTraceOptions(),
            ...tree.step.opts,
            ...jobRetryOptions(job._internal.options),
        },
    };
    if (tree.children.length === 0)
        return node;
    return { ...node, children: tree.children.map(child => toFlowJobNode(child, input)) };
}
/**
 * The BullMQ flow jobs of a built flow for one (already validated) input:
 * one tree per root step. Pure: touches no Redis.
 */
export function toFlowJobs(flow, input) {
    const internal = flow._internal;
    return stepTrees(internal).map(tree => toFlowJobNode(tree, input));
}
/**
 * Validate `input` with the flow's schema (async: the enqueue call already awaits).
 * Returns `InvalidInput` when the input does not match, or `ValidatorDefect` when the schema cannot run.
 */
export async function parseFlowInput(flow, input) {
    const internal = flow._internal;
    return parseAsync(internal.inputSchema, input);
}
function collectJobIds(trees, nodes, into) {
    // A transport acknowledgement must cover the submitted tree exactly. Missing IDs
    // cannot prove refusal: Redis may already have accepted every application job.
    if (!Array.isArray(nodes) || nodes.length !== trees.length)
        return false;
    for (const [index, tree] of trees.entries()) {
        const node = nodes[index];
        const id = node?.job?.id;
        if (typeof id !== 'string' || id.length === 0)
            return false;
        if (node.job.name !== tree.step.job._internal.name || node.job.queueName !== tree.step.job._internal.name) {
            return false;
        }
        into.set(tree.step.id, id);
        if (!collectJobIds(tree.children, node.children === undefined ? [] : node.children, into))
            return false;
    }
    return true;
}
/**
 * Validate the input, then add the whole flow in one atomic `addBulk`.
 * Invalid input or a broken data mapper returns a canonical failure before opening the producer.
 */
export async function addFlow(openProducer, flow, input) {
    const internal = flow._internal;
    return withEnqueueSpan(() => addFlowOwned(openProducer, flow, input, internal), internal.name, 'queue.flow.enqueue');
}
async function addFlowOwned(openProducer, flow, input, internal) {
    const validated = await parseFlowInput(flow, input);
    if (InvalidInput.is(validated) || ValidatorDefect.is(validated))
        return validated;
    let jobs;
    try {
        jobs = toFlowJobs(flow, validated);
        const validateTree = async (tree, node) => {
            // A mapper declares job input, not a business outcome. Never enqueue a refusal inside a success tree.
            if (isFailure(node.data))
                return UnexpectedDefect({ cause: node.data });
            const parsed = await parseAsync(tree.step.job._internal.inputSchema, node.data);
            if (InvalidInput.is(parsed) || ValidatorDefect.is(parsed))
                return parsed;
            for (const [index, child] of tree.children.entries()) {
                const childNode = node.children?.[index];
                if (childNode === undefined)
                    return UnexpectedDefect();
                const failure = await validateTree(child, childNode);
                if (failure !== undefined)
                    return failure;
            }
            return undefined;
        };
        for (const [index, tree] of stepTrees(internal).entries()) {
            const node = jobs[index];
            if (node === undefined)
                return UnexpectedDefect();
            const failure = await validateTree(tree, node);
            if (failure !== undefined)
                return failure;
        }
    }
    catch (error) {
        return UnexpectedDefect({ cause: error });
    }
    try {
        const nodes = await openProducer().addBulk(jobs);
        const jobIds = new Map();
        if (!collectJobIds(stepTrees(internal), nodes, jobIds))
            return QueueAcceptanceUnknown();
        observeQueue(() => debugFlow.debug('[{flow}] Started flow with {roots} root job(s)', { flow: internal.name, roots: nodes.length }));
        return { flow: internal.name, jobIds: Object.fromEntries(jobIds) };
    }
    catch (error) {
        // Includes malformed acknowledgements with throwing accessors, after dispatch.
        return QueueAcceptanceUnknown({ cause: error });
    }
}
//# sourceMappingURL=flow-jobs.js.map