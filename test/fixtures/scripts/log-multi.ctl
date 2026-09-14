// Emits three WARNING events via throwError.
// DebugN does not produce PVSS log output in standalone (-n) mode.
// Run with: WCCOActrl log-multi.ctl -proj <name> -n
main()
{
    throwError(makeError("LogIntegTest", PRIO_WARNING, ERR_CONTROL, 10, "LogIntegTest MULTI first"));
    throwError(makeError("LogIntegTest", PRIO_WARNING, ERR_CONTROL, 11, "LogIntegTest MULTI second"));
    throwError(makeError("LogIntegTest", PRIO_WARNING, ERR_CONTROL, 12, "LogIntegTest MULTI third"));
    exit(0);
}
