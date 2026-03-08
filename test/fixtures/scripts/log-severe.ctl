// Emits a SEVERE log event via throwError/makeError.
// Run with: WCCOActrl log-severe.ctl -proj <name> -n
main()
{
    throwError(makeError("LogIntegTest", PRIO_SEVERE, ERR_CONTROL, 99, "LogIntegTest SEVERE message"));
    exit(0);
}
