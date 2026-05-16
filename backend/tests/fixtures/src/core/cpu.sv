module cpu (
    input  logic clk,
    input  logic rst_n,
    inout  logic [31:0] data,
    output logic [15:0] addr
);

    wire [31:0] alu_result;
    wire [4:0]  reg_addr;
    wire [31:0] reg_data;

    alu u_alu (
        .clk(clk),
        .a(reg_data),
        .b(data),
        .result(alu_result)
    );

    regfile #(.NUM_REGS(32)) u_regfile (
        .clk(clk),
        .rst_n(rst_n),
        .addr(reg_addr),
        .data(reg_data)
    );

endmodule
