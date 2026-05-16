module core (
    input  logic clk,
    input  logic rst_n,
    output logic [31:0] result,
    output logic [15:0] addr
);

    wire [31:0] fetch_instr;
    wire [31:0] exec_result;
    wire [15:0] pc;

    fetch u_fetch (
        .clk(clk),
        .rst_n(rst_n),
        .instr(fetch_instr),
        .pc(pc)
    );

    exec_unit u_exec (
        .clk(clk),
        .instr(fetch_instr),
        .result(exec_result)
    );

    assign result = exec_result;
    assign addr   = pc;

endmodule
