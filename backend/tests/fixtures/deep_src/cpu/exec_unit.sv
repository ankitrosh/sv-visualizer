module exec_unit (
    input  logic clk,
    input  logic [31:0] instr,
    output logic [31:0] result
);

    wire [31:0] alu_out;
    wire [31:0] mul_out;
    wire [4:0]  opcode;

    alu u_alu (
        .clk(clk),
        .a(instr[15:0]),
        .b(instr[31:16]),
        .op(opcode),
        .result(alu_out)
    );

    mul_unit u_mul (
        .clk(clk),
        .a(instr[15:0]),
        .b(instr[31:16]),
        .result(mul_out)
    );

    assign result = alu_out;

endmodule
