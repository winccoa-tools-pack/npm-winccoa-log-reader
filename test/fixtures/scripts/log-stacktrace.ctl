// Emits a WARNING from a nested function call, producing a stacktrace.
// Run with: WCCOActrl log-stacktrace.ctl -proj <name> -n

void innerFunc()
{
    throwError(makeError("LogIntegTest", PRIO_WARNING, ERR_CONTROL, 7, "LogIntegTest STACKTRACE warning"));
}

void outerFunc()
{
    innerFunc();
}

main()
{
    outerFunc();
    exit(0);
}
