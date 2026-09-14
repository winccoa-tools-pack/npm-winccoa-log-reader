// Emits one WARNING event. The test asserts on severity and message.
// We rely on throwError (which logs in PVSS format) since DebugN does
// not produce output in standalone (-n) mode.
// Run with: WCCOActrl log-warning-info.ctl -proj <name> -n
main()
{
    throwError(makeError("LogIntegTest", PRIO_WARNING, ERR_CONTROL, 1, "LogIntegTest INFO-like message"));
    exit(0);
}
